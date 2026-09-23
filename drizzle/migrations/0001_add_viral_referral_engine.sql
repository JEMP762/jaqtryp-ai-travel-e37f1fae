ALTER TABLE public.shared_results
  ADD COLUMN IF NOT EXISTS source_result_id uuid,
  ADD COLUMN IF NOT EXISTS referral_code_snapshot text,
  ADD COLUMN IF NOT EXISTS feature text;

CREATE UNIQUE INDEX IF NOT EXISTS shared_results_source_result_unique
  ON public.shared_results(owner_id, source_result_id)
  WHERE source_result_id IS NOT NULL;

CREATE TABLE public.viral_reward_settings (
  event_key text PRIMARY KEY CHECK (event_key IN ('registration','activation')),
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.viral_reward_settings TO authenticated;
GRANT ALL ON public.viral_reward_settings TO service_role;
ALTER TABLE public.viral_reward_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read viral reward settings"
  ON public.viral_reward_settings FOR SELECT TO authenticated USING (true);

CREATE TABLE public.viral_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid,
  share_id uuid REFERENCES public.shared_results(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  visitor_hash text,
  feature text,
  source text,
  status text NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked','registered','activated','rewarded','rejected')),
  reject_reason text,
  registered_at timestamptz,
  activated_at timestamptz,
  rewarded_at timestamptz,
  reward_credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.viral_referrals TO authenticated;
GRANT ALL ON public.viral_referrals TO service_role;
ALTER TABLE public.viral_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read viral referrals"
  ON public.viral_referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE UNIQUE INDEX viral_referrals_visitor_first_touch_unique
  ON public.viral_referrals(visitor_hash) WHERE visitor_hash IS NOT NULL;
CREATE UNIQUE INDEX viral_referrals_referred_unique
  ON public.viral_referrals(referred_id) WHERE referred_id IS NOT NULL;
CREATE INDEX viral_referrals_referrer_recent_idx
  ON public.viral_referrals(referrer_id, created_at DESC);
CREATE INDEX viral_referrals_status_recent_idx
  ON public.viral_referrals(status, created_at DESC);

CREATE TABLE public.viral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid REFERENCES public.viral_referrals(id) ON DELETE SET NULL,
  share_id uuid REFERENCES public.shared_results(id) ON DELETE SET NULL,
  referrer_id uuid,
  referred_id uuid,
  visitor_hash text,
  event_name text NOT NULL CHECK (event_name IN ('share_created','share_clicked','referral_captured','referral_signup','referral_activation','referral_rewarded','referral_rejected','referral_payment')),
  feature text,
  source text,
  idempotency_key text UNIQUE,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.viral_events TO authenticated;
GRANT ALL ON public.viral_events TO service_role;
ALTER TABLE public.viral_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read viral events"
  ON public.viral_events FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE INDEX viral_events_name_recent_idx ON public.viral_events(event_name, created_at DESC);
CREATE INDEX viral_events_referrer_recent_idx ON public.viral_events(referrer_id, created_at DESC);

ALTER TABLE public.referral_rewards DROP CONSTRAINT IF EXISTS referral_rewards_source_check;
ALTER TABLE public.referral_rewards ADD CONSTRAINT referral_rewards_source_check
  CHECK (source IN ('pack','sub_pro','sub_ultra','registration','activation'));

CREATE OR REPLACE FUNCTION public.capture_viral_click(
  _code text,
  _share_slug text,
  _visitor_hash text,
  _source text DEFAULT 'shared_result'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
  v_share_id uuid;
  v_feature text;
  v_journey public.viral_referrals;
BEGIN
  IF _visitor_hash IS NULL OR length(_visitor_hash) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_visitor');
  END IF;
  SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code');
  END IF;
  IF _share_slug IS NOT NULL THEN
    SELECT id, feature INTO v_share_id, v_feature
      FROM public.shared_results
     WHERE slug = _share_slug AND owner_id = v_referrer AND active = true;
    IF v_share_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'share_owner_mismatch');
    END IF;
  END IF;

  INSERT INTO public.viral_referrals(referrer_id, share_id, referral_code, visitor_hash, feature, source)
  VALUES (v_referrer, v_share_id, upper(trim(_code)), _visitor_hash, v_feature, left(coalesce(_source, 'shared_result'), 80))
  ON CONFLICT (visitor_hash) WHERE visitor_hash IS NOT NULL DO NOTHING;

  SELECT * INTO v_journey FROM public.viral_referrals WHERE visitor_hash = _visitor_hash;
  INSERT INTO public.viral_events(journey_id, share_id, referrer_id, visitor_hash, event_name, feature, source, idempotency_key)
  VALUES (v_journey.id, v_journey.share_id, v_journey.referrer_id, _visitor_hash, 'share_clicked', v_journey.feature, v_journey.source,
          'click:' || _visitor_hash || ':' || coalesce(v_journey.share_id::text, 'general'))
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'journey_id', v_journey.id, 'first_touch', v_journey.referral_code);
END;
$$;
REVOKE ALL ON FUNCTION public.capture_viral_click(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_viral_click(text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.register_viral_referral(
  _code text,
  _visitor_hash text DEFAULT NULL,
  _share_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_current uuid;
  v_journey_id uuid;
  v_share_id uuid;
  v_feature text;
  v_credits integer := 0;
  v_enabled boolean := false;
  v_reward_key text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF v_referrer IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code'); END IF;
  IF v_referrer = v_uid THEN
    INSERT INTO public.viral_events(referrer_id, referred_id, visitor_hash, event_name, source, idempotency_key, properties)
    VALUES (v_referrer, v_uid, _visitor_hash, 'referral_rejected', 'signup', 'reject:self:' || v_uid::text,
            jsonb_build_object('reason','self_referral')) ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  SELECT referred_by INTO v_current FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_current IS NOT NULL AND v_current <> v_referrer THEN
    INSERT INTO public.viral_events(referrer_id, referred_id, visitor_hash, event_name, source, idempotency_key, properties)
    VALUES (v_referrer, v_uid, _visitor_hash, 'referral_rejected', 'signup', 'reject:existing:' || v_uid::text,
            jsonb_build_object('reason','already_referred')) ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;
  IF v_current IS NULL THEN UPDATE public.profiles SET referred_by = v_referrer WHERE id = v_uid AND referred_by IS NULL; END IF;

  IF _share_slug IS NOT NULL THEN
    SELECT id, feature INTO v_share_id, v_feature FROM public.shared_results
     WHERE slug = _share_slug AND owner_id = v_referrer AND active = true;
  END IF;

  SELECT id INTO v_journey_id FROM public.viral_referrals
   WHERE (_visitor_hash IS NOT NULL AND visitor_hash = _visitor_hash) OR referred_id = v_uid
   ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_journey_id IS NULL THEN
    INSERT INTO public.viral_referrals(referrer_id, referred_id, share_id, referral_code, visitor_hash, feature, source, status, registered_at)
    VALUES (v_referrer, v_uid, v_share_id, upper(trim(_code)), _visitor_hash, v_feature, 'signup', 'registered', now())
    RETURNING id INTO v_journey_id;
  ELSE
    UPDATE public.viral_referrals SET referred_id = v_uid, status = CASE WHEN status = 'clicked' THEN 'registered' ELSE status END,
      registered_at = coalesce(registered_at, now()), updated_at = now()
    WHERE id = v_journey_id AND referrer_id = v_referrer;
  END IF;

  INSERT INTO public.viral_events(journey_id, share_id, referrer_id, referred_id, visitor_hash, event_name, feature, source, idempotency_key)
  VALUES (v_journey_id, v_share_id, v_referrer, v_uid, _visitor_hash, 'referral_signup', v_feature, 'signup', 'signup:' || v_uid::text)
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT credits, enabled INTO v_credits, v_enabled FROM public.viral_reward_settings WHERE event_key = 'registration';
  IF coalesce(v_enabled, false) AND coalesce(v_credits, 0) > 0 THEN
    v_reward_key := 'viral:registration:' || v_uid::text;
    PERFORM public.add_credits(v_referrer, v_credits, 'referral_bonus', 'topup', v_reward_key,
      jsonb_build_object('kind','registration','referred_user',v_uid,'journey_id',v_journey_id));
    INSERT INTO public.referral_rewards(referrer_id, referred_id, source, credits, stripe_ref, metadata)
    VALUES (v_referrer, v_uid, 'registration', v_credits, v_reward_key, jsonb_build_object('journey_id',v_journey_id))
    ON CONFLICT (stripe_ref) DO NOTHING;
    UPDATE public.viral_referrals SET status='rewarded', rewarded_at=coalesce(rewarded_at,now()), reward_credits=reward_credits+v_credits, updated_at=now()
      WHERE id=v_journey_id;
    INSERT INTO public.viral_events(journey_id, referrer_id, referred_id, event_name, feature, source, idempotency_key, properties)
    VALUES (v_journey_id,v_referrer,v_uid,'referral_rewarded',v_feature,'registration','reward:registration:'||v_uid::text,jsonb_build_object('credits',v_credits))
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer, 'journey_id', v_journey_id);
END;
$$;
REVOKE ALL ON FUNCTION public.register_viral_referral(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_viral_referral(text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_viral_referral(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_referrer uuid;
  v_journey_id uuid;
  v_feature text;
  v_credits integer := 0;
  v_enabled boolean := false;
  v_reward_key text;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> _user THEN RETURN jsonb_build_object('ok',false,'reason','forbidden'); END IF;
  SELECT referred_by INTO v_referrer FROM public.profiles WHERE id=_user;
  IF v_referrer IS NULL OR v_referrer=_user THEN RETURN jsonb_build_object('ok',false,'reason','no_referrer'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_results WHERE user_id=_user) THEN RETURN jsonb_build_object('ok',false,'reason','not_activated'); END IF;
  SELECT id, feature INTO v_journey_id, v_feature FROM public.viral_referrals WHERE referred_id=_user ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_journey_id IS NULL THEN
    INSERT INTO public.viral_referrals(referrer_id,referred_id,referral_code,feature,source,status,registered_at,activated_at)
    SELECT v_referrer,_user,referral_code,NULL,'activation','activated',created_at,now() FROM public.profiles WHERE id=v_referrer
    RETURNING id INTO v_journey_id;
  ELSE
    UPDATE public.viral_referrals SET status=CASE WHEN status IN ('clicked','registered') THEN 'activated' ELSE status END,
      activated_at=coalesce(activated_at,now()), updated_at=now() WHERE id=v_journey_id;
  END IF;
  INSERT INTO public.viral_events(journey_id,referrer_id,referred_id,event_name,feature,source,idempotency_key)
  VALUES(v_journey_id,v_referrer,_user,'referral_activation',v_feature,'first_result','activation:'||_user::text)
  ON CONFLICT(idempotency_key) DO NOTHING;
  SELECT credits,enabled INTO v_credits,v_enabled FROM public.viral_reward_settings WHERE event_key='activation';
  IF coalesce(v_enabled,false) AND coalesce(v_credits,0)>0 THEN
    v_reward_key := 'viral:activation:'||_user::text;
    PERFORM public.add_credits(v_referrer,v_credits,'referral_bonus','topup',v_reward_key,
      jsonb_build_object('kind','activation','referred_user',_user,'journey_id',v_journey_id));
    INSERT INTO public.referral_rewards(referrer_id,referred_id,source,credits,stripe_ref,metadata)
    VALUES(v_referrer,_user,'activation',v_credits,v_reward_key,jsonb_build_object('journey_id',v_journey_id))
    ON CONFLICT(stripe_ref) DO NOTHING;
    UPDATE public.viral_referrals SET status='rewarded',rewarded_at=coalesce(rewarded_at,now()),reward_credits=reward_credits+v_credits,updated_at=now() WHERE id=v_journey_id;
    INSERT INTO public.viral_events(journey_id,referrer_id,referred_id,event_name,feature,source,idempotency_key,properties)
    VALUES(v_journey_id,v_referrer,_user,'referral_rewarded',v_feature,'activation','reward:activation:'||_user::text,jsonb_build_object('credits',v_credits))
    ON CONFLICT(idempotency_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok',true,'journey_id',v_journey_id);
END;
$$;
REVOKE ALL ON FUNCTION public.activate_viral_referral(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_viral_referral(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_viral_payment(_paid_user uuid, _external_ref text, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_referrer uuid; v_journey uuid;
BEGIN
  SELECT referred_by INTO v_referrer FROM public.profiles WHERE id=_paid_user;
  IF v_referrer IS NULL OR v_referrer=_paid_user THEN RETURN; END IF;
  SELECT id INTO v_journey FROM public.viral_referrals WHERE referred_id=_paid_user ORDER BY created_at LIMIT 1;
  INSERT INTO public.viral_events(journey_id,referrer_id,referred_id,event_name,source,idempotency_key,properties)
  VALUES(v_journey,v_referrer,_paid_user,'referral_payment',_kind,'payment:'||_external_ref,jsonb_build_object('kind',_kind))
  ON CONFLICT(idempotency_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.record_viral_payment(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_viral_payment(uuid,text,text) TO service_role;