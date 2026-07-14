
-- 1) Profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Generator
CREATE OR REPLACE FUNCTION public.generate_referral_code(_uid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_try int := 0;
BEGIN
  LOOP
    v_code := upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), 1, 8));
    v_code := regexp_replace(v_code, '[^A-Z0-9]', 'X', 'g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
    v_try := v_try + 1;
    IF v_try > 10 THEN
      v_code := upper(substr(replace(_uid::text,'-',''),1,8));
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END $$;

-- Backfill existing profiles
UPDATE public.profiles
SET referral_code = public.generate_referral_code(id)
WHERE referral_code IS NULL;

-- Trigger to set on insert
CREATE OR REPLACE FUNCTION public.set_referral_code_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_set_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code_on_profile();

-- 2) Referral rewards table
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('pack','sub_pro','sub_ultra')),
  credits int NOT NULL CHECK (credits > 0),
  stripe_ref text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer reads own rewards" ON public.referral_rewards
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON public.referral_rewards(referred_id);

-- 3) RPC apply referral code
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ref uuid;
  v_current uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_code');
  END IF;

  SELECT referred_by INTO v_current FROM public.profiles WHERE id = v_uid;
  IF v_current IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  SELECT id INTO v_ref FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code');
  END IF;
  IF v_ref = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  UPDATE public.profiles SET referred_by = v_ref WHERE id = v_uid AND referred_by IS NULL;
  RETURN jsonb_build_object('ok', true, 'referrer_id', v_ref);
END $$;

REVOKE ALL ON FUNCTION public.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;

-- 4) RPC reward referrer (called from webhook)
CREATE OR REPLACE FUNCTION public.reward_referrer(
  _paid_user uuid,
  _kind text,               -- 'pack' | 'sub_pro' | 'sub_ultra'
  _pack_credits int,        -- for 'pack', pass amount purchased; ignored for subs
  _stripe_ref text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
  v_credits int;
BEGIN
  SELECT referred_by INTO v_referrer FROM public.profiles WHERE id = _paid_user;
  IF v_referrer IS NULL OR v_referrer = _paid_user THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_referrer');
  END IF;

  IF _kind = 'pack' THEN
    v_credits := GREATEST(0, floor(COALESCE(_pack_credits,0) * 0.10)::int);
  ELSIF _kind = 'sub_pro' THEN
    v_credits := 100;
  ELSIF _kind = 'sub_ultra' THEN
    v_credits := 200;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  END IF;

  IF v_credits <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'zero_credits');
  END IF;

  -- Idempotent by stripe_ref
  IF _stripe_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.referral_rewards WHERE stripe_ref = _stripe_ref
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_rewarded');
  END IF;

  INSERT INTO public.referral_rewards(referrer_id, referred_id, source, credits, stripe_ref, metadata)
    VALUES (v_referrer, _paid_user, _kind, v_credits, _stripe_ref,
            jsonb_build_object('pack_credits', _pack_credits));

  PERFORM public.add_credits(
    v_referrer,
    v_credits,
    'referral_bonus',
    'topup',
    'ref:' || COALESCE(_stripe_ref, gen_random_uuid()::text),
    jsonb_build_object('kind', _kind, 'referred_user', _paid_user)
  );

  RETURN jsonb_build_object('ok', true, 'credits', v_credits, 'referrer', v_referrer);
END $$;

REVOKE ALL ON FUNCTION public.reward_referrer(uuid, text, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_referrer(uuid, text, int, text) TO service_role;
