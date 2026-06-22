
CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_credits_select" ON public.user_credits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER user_credits_updated_at BEFORE UPDATE ON public.user_credits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_ledger_select" ON public.credit_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX credit_ledger_user_created_idx ON public.credit_ledger (user_id, created_at DESC);
CREATE UNIQUE INDEX credit_ledger_session_unique ON public.credit_ledger (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.spend_credits(_user uuid, _amount int, _reason text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_balance int;
BEGIN
  IF _amount <= 0 THEN RETURN false; END IF;
  INSERT INTO user_credits(user_id) VALUES(_user) ON CONFLICT DO NOTHING;
  UPDATE user_credits
    SET balance = balance - _amount,
        lifetime_spent = lifetime_spent + _amount,
        updated_at = now()
    WHERE user_id = _user AND balance >= _amount
    RETURNING balance INTO new_balance;
  IF new_balance IS NULL THEN RETURN false; END IF;
  INSERT INTO credit_ledger(user_id, delta, reason, metadata) VALUES(_user, -_amount, _reason, _meta);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_credits(_user uuid, _amount int, _reason text, _session text DEFAULT NULL, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;
  -- Idempotência por session_id
  IF _session IS NOT NULL AND EXISTS (SELECT 1 FROM credit_ledger WHERE stripe_session_id = _session) THEN
    RETURN;
  END IF;
  INSERT INTO user_credits(user_id, balance, lifetime_purchased)
    VALUES(_user, _amount, CASE WHEN _reason = 'purchase' THEN _amount ELSE 0 END)
  ON CONFLICT(user_id) DO UPDATE
    SET balance = user_credits.balance + _amount,
        lifetime_purchased = user_credits.lifetime_purchased + CASE WHEN _reason = 'purchase' THEN _amount ELSE 0 END,
        updated_at = now();
  INSERT INTO credit_ledger(user_id, delta, reason, stripe_session_id, metadata)
    VALUES(_user, _amount, _reason, _session, _meta);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, int, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, int, text, text, jsonb) TO service_role;

-- Atualizar handle_new_user para dar 100 créditos de bônus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'free');
  INSERT INTO public.user_credits (user_id, balance, lifetime_purchased)
    VALUES (NEW.id, 100, 0);
  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
    VALUES (NEW.id, 100, 'signup_bonus', '{"note":"Welcome bonus"}'::jsonb);
  RETURN NEW;
END;
$function$;

-- Backfill: dar 100 créditos para usuários existentes que ainda não têm carteira
INSERT INTO public.user_credits (user_id, balance, lifetime_purchased)
SELECT u.id, 100, 0 FROM auth.users u
LEFT JOIN public.user_credits c ON c.user_id = u.id
WHERE c.user_id IS NULL;

INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
SELECT u.id, 100, 'signup_bonus_backfill', '{"note":"Backfill welcome bonus"}'::jsonb
FROM auth.users u
LEFT JOIN public.credit_ledger l ON l.user_id = u.id AND l.reason IN ('signup_bonus','signup_bonus_backfill')
WHERE l.id IS NULL;
