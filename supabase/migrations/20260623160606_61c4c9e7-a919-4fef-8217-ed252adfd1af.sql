
-- =====================================================================
-- 1. user_credits: adicionar buckets separados
-- =====================================================================
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS free_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topup_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_grant integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_reset_at timestamptz;

-- Migrar saldo antigo para free_balance (uma vez)
UPDATE public.user_credits
  SET free_balance = GREATEST(free_balance, balance)
  WHERE balance > 0 AND free_balance = 0;

-- Manter `balance` como soma calculada (drop antigo, recriar como gerada)
ALTER TABLE public.user_credits DROP COLUMN balance;
ALTER TABLE public.user_credits
  ADD COLUMN balance integer GENERATED ALWAYS AS (free_balance + monthly_balance + topup_balance) STORED;

-- Constraints de não-negativo
ALTER TABLE public.user_credits
  ADD CONSTRAINT user_credits_free_nonneg CHECK (free_balance >= 0),
  ADD CONSTRAINT user_credits_monthly_nonneg CHECK (monthly_balance >= 0),
  ADD CONSTRAINT user_credits_topup_nonneg CHECK (topup_balance >= 0);

-- =====================================================================
-- 2. credit_costs: catálogo de custo por feature
-- =====================================================================
CREATE TABLE public.credit_costs (
  feature_key text PRIMARY KEY,
  cost integer NOT NULL CHECK (cost >= 0),
  label text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_costs TO authenticated;
GRANT ALL ON public.credit_costs TO service_role;

ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read credit costs"
  ON public.credit_costs FOR SELECT TO authenticated USING (true);

CREATE TRIGGER credit_costs_touch
  BEFORE UPDATE ON public.credit_costs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed inicial (markup ~80% sobre custo provedor — ajustar depois)
INSERT INTO public.credit_costs (feature_key, cost, label, description) VALUES
  ('itinerary_ai',       30, 'Roteiro IA',              'Gerar roteiro completo com IA'),
  ('pdf_export',          5, 'Exportar PDF',            'Exportar roteiro em PDF'),
  ('translate_text',      2, 'Traduzir texto',          'Tradução de texto digitado'),
  ('translate_voice',     8, 'Tradução por voz',        'Falar e traduzir (STT + tradução + TTS)'),
  ('translate_live',     15, 'Tradutor ao vivo',        'Sessão de tradução ao vivo (5 min)'),
  ('translate_image',     6, 'Tradução de imagem',      'OCR + tradução de imagem'),
  ('translate_file',     12, 'Tradução de arquivo',     'Tradução de documento completo'),
  ('bluetooth_session',  10, 'Sessão Bluetooth',        'Conexão Bluetooth do tradutor ao vivo (10 min)')
ON CONFLICT (feature_key) DO NOTHING;

-- =====================================================================
-- 3. spend_credits: ordem mensal → grátis → topup
-- =====================================================================
CREATE OR REPLACE FUNCTION public.spend_credits(
  _user uuid,
  _amount integer,
  _reason text,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free int; v_monthly int; v_topup int; v_total int;
  spend_monthly int := 0; spend_free int := 0; spend_topup int := 0;
  remaining int;
BEGIN
  IF _amount <= 0 THEN RETURN false; END IF;

  INSERT INTO user_credits(user_id) VALUES(_user) ON CONFLICT DO NOTHING;

  SELECT free_balance, monthly_balance, topup_balance
    INTO v_free, v_monthly, v_topup
    FROM user_credits
    WHERE user_id = _user
    FOR UPDATE;

  v_total := v_free + v_monthly + v_topup;
  IF v_total < _amount THEN RETURN false; END IF;

  remaining := _amount;
  -- 1) mensal (expira)
  spend_monthly := LEAST(remaining, v_monthly);
  remaining := remaining - spend_monthly;
  -- 2) grátis (bônus)
  spend_free := LEAST(remaining, v_free);
  remaining := remaining - spend_free;
  -- 3) avulso (pago, preservar)
  spend_topup := remaining;

  UPDATE user_credits SET
    monthly_balance = monthly_balance - spend_monthly,
    free_balance    = free_balance - spend_free,
    topup_balance   = topup_balance - spend_topup,
    lifetime_spent  = lifetime_spent + _amount,
    updated_at      = now()
  WHERE user_id = _user;

  INSERT INTO credit_ledger(user_id, delta, reason, metadata)
  VALUES (_user, -_amount, _reason,
    _meta || jsonb_build_object(
      'spent_monthly', spend_monthly,
      'spent_free',    spend_free,
      'spent_topup',   spend_topup
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_credits(uuid, integer, text, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, integer, text, jsonb) TO service_role;

-- =====================================================================
-- 4. add_credits: bucket-aware
-- =====================================================================
DROP FUNCTION IF EXISTS public.add_credits(uuid, integer, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.add_credits(
  _user uuid,
  _amount integer,
  _reason text,
  _bucket text DEFAULT 'topup',  -- 'free' | 'monthly' | 'topup'
  _session text DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;
  IF _bucket NOT IN ('free','monthly','topup') THEN
    RAISE EXCEPTION 'invalid bucket: %', _bucket;
  END IF;

  -- Idempotência por session_id
  IF _session IS NOT NULL AND EXISTS (
    SELECT 1 FROM credit_ledger WHERE stripe_session_id = _session
  ) THEN
    RETURN;
  END IF;

  INSERT INTO user_credits(user_id) VALUES(_user) ON CONFLICT DO NOTHING;

  IF _bucket = 'free' THEN
    UPDATE user_credits SET
      free_balance = free_balance + _amount,
      updated_at = now()
    WHERE user_id = _user;
  ELSIF _bucket = 'monthly' THEN
    UPDATE user_credits SET
      monthly_balance = monthly_balance + _amount,
      updated_at = now()
    WHERE user_id = _user;
  ELSE
    UPDATE user_credits SET
      topup_balance = topup_balance + _amount,
      lifetime_purchased = lifetime_purchased + CASE WHEN _reason = 'purchase' THEN _amount ELSE 0 END,
      updated_at = now()
    WHERE user_id = _user;
  END IF;

  INSERT INTO credit_ledger(user_id, delta, reason, stripe_session_id, metadata)
  VALUES (_user, _amount, _reason, _session, _meta || jsonb_build_object('bucket', _bucket));
END;
$$;

REVOKE ALL ON FUNCTION public.add_credits(uuid, integer, text, text, text, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, text, jsonb) TO service_role;

-- =====================================================================
-- 5. spend_for_feature: gasto baseado no catálogo
-- =====================================================================
CREATE OR REPLACE FUNCTION public.spend_for_feature(
  _user uuid,
  _feature text,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int;
  v_have int;
  v_ok boolean;
BEGIN
  SELECT cost INTO v_cost FROM credit_costs WHERE feature_key = _feature AND active = true;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_feature');
  END IF;

  SELECT balance INTO v_have FROM user_credits WHERE user_id = _user;
  v_have := COALESCE(v_have, 0);

  IF v_have < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'needed', v_cost, 'have', v_have);
  END IF;

  v_ok := public.spend_credits(_user, v_cost, 'feature:' || _feature, _meta || jsonb_build_object('feature', _feature));
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'spend_failed');
  END IF;

  SELECT balance INTO v_have FROM user_credits WHERE user_id = _user;
  RETURN jsonb_build_object('ok', true, 'spent', v_cost, 'balance', v_have);
END;
$$;

REVOKE ALL ON FUNCTION public.spend_for_feature(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_for_feature(uuid, text, jsonb) TO authenticated, service_role;

-- =====================================================================
-- 6. Reset mensal
-- =====================================================================
CREATE OR REPLACE FUNCTION public.grant_monthly_credits(
  _user uuid,
  _amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount < 0 THEN RETURN; END IF;

  INSERT INTO user_credits(user_id) VALUES(_user) ON CONFLICT DO NOTHING;

  UPDATE user_credits SET
    monthly_balance  = _amount,
    monthly_grant    = _amount,
    monthly_reset_at = (COALESCE(monthly_reset_at, now()) + interval '1 month'),
    updated_at       = now()
  WHERE user_id = _user;

  INSERT INTO credit_ledger(user_id, delta, reason, metadata)
  VALUES (_user, _amount, 'monthly_grant', jsonb_build_object('bucket', 'monthly'));
END;
$$;

REVOKE ALL ON FUNCTION public.grant_monthly_credits(uuid, integer) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits(uuid, integer) TO service_role;

-- Processa todos os resets vencidos (chamado pelo cron)
CREATE OR REPLACE FUNCTION public.process_monthly_resets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  processed int := 0;
BEGIN
  FOR r IN
    SELECT uc.user_id, uc.monthly_grant
    FROM user_credits uc
    WHERE uc.monthly_reset_at IS NOT NULL
      AND uc.monthly_reset_at <= now()
      AND uc.monthly_grant > 0
      AND EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = uc.user_id
          AND s.status IN ('active','trialing')
      )
  LOOP
    PERFORM public.grant_monthly_credits(r.user_id, r.monthly_grant);
    processed := processed + 1;
  END LOOP;
  RETURN processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_monthly_resets() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.process_monthly_resets() TO service_role;

-- =====================================================================
-- 7. Trigger de signup: 100 créditos no bucket "free"
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'free');
  INSERT INTO public.user_credits (user_id, free_balance, lifetime_purchased)
    VALUES (NEW.id, 100, 0);
  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
    VALUES (NEW.id, 100, 'signup_bonus', '{"bucket":"free","note":"Welcome bonus"}'::jsonb);
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 8. Cron diário para renovação mensal
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jaqtryp_monthly_credit_reset') THEN
    PERFORM cron.schedule(
      'jaqtryp_monthly_credit_reset',
      '0 0 * * *',
      $cron$ SELECT public.process_monthly_resets(); $cron$
    );
  END IF;
END $$;
