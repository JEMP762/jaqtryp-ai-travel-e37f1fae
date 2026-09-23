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
  v_uid uuid := auth.uid(); v_referrer uuid; v_current uuid; v_journey_id uuid; v_share_id uuid; v_feature text;
  v_credits integer := 0; v_enabled boolean := false; v_reward_key text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
  SELECT id INTO v_referrer FROM public.profiles WHERE referral_code=upper(trim(_code));
  IF v_referrer IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unknown_code'); END IF;
  IF v_referrer=v_uid THEN
    INSERT INTO public.viral_events(referrer_id,referred_id,visitor_hash,event_name,source,idempotency_key,properties)
    VALUES(v_referrer,v_uid,_visitor_hash,'referral_rejected','signup','reject:self:'||v_uid::text,jsonb_build_object('reason','self_referral')) ON CONFLICT(idempotency_key) DO NOTHING;
    RETURN jsonb_build_object('ok',false,'reason','self_referral');
  END IF;
  SELECT referred_by INTO v_current FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF v_current IS NOT NULL AND v_current<>v_referrer THEN
    INSERT INTO public.viral_events(referrer_id,referred_id,visitor_hash,event_name,source,idempotency_key,properties)
    VALUES(v_referrer,v_uid,_visitor_hash,'referral_rejected','signup','reject:existing:'||v_uid::text,jsonb_build_object('reason','already_referred')) ON CONFLICT(idempotency_key) DO NOTHING;
    RETURN jsonb_build_object('ok',false,'reason','already_referred');
  END IF;
  IF v_current IS NULL THEN UPDATE public.profiles SET referred_by=v_referrer WHERE id=v_uid AND referred_by IS NULL; END IF;
  IF nullif(_share_slug,'') IS NOT NULL THEN
    SELECT id,feature INTO v_share_id,v_feature FROM public.shared_results WHERE slug=_share_slug AND owner_id=v_referrer AND active=true;
  END IF;
  SELECT id INTO v_journey_id FROM public.viral_referrals
   WHERE (_visitor_hash IS NOT NULL AND visitor_hash=_visitor_hash) OR referred_id=v_uid ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_journey_id IS NULL THEN
    INSERT INTO public.viral_referrals(referrer_id,referred_id,share_id,referral_code,visitor_hash,feature,source,status,registered_at)
    VALUES(v_referrer,v_uid,v_share_id,upper(trim(_code)),_visitor_hash,v_feature,'signup','registered',now()) RETURNING id INTO v_journey_id;
  ELSE
    UPDATE public.viral_referrals SET referred_id=v_uid,status=CASE WHEN status='clicked' THEN 'registered' ELSE status END,
      registered_at=coalesce(registered_at,now()),updated_at=now() WHERE id=v_journey_id AND referrer_id=v_referrer;
  END IF;
  INSERT INTO public.viral_events(journey_id,share_id,referrer_id,referred_id,visitor_hash,event_name,feature,source,idempotency_key)
  VALUES(v_journey_id,v_share_id,v_referrer,v_uid,_visitor_hash,'referral_signup',v_feature,'signup','signup:'||v_uid::text) ON CONFLICT(idempotency_key) DO NOTHING;
  SELECT credits,enabled INTO v_credits,v_enabled FROM public.viral_reward_settings WHERE event_key='registration';
  v_reward_key := 'viral:registration:'||v_uid::text;
  IF coalesce(v_enabled,false) AND coalesce(v_credits,0)>0 AND NOT EXISTS(SELECT 1 FROM public.referral_rewards WHERE stripe_ref=v_reward_key) THEN
    PERFORM public.add_credits(v_referrer,v_credits,'referral_bonus','topup',v_reward_key,jsonb_build_object('kind','registration','referred_user',v_uid,'journey_id',v_journey_id));
    INSERT INTO public.referral_rewards(referrer_id,referred_id,source,credits,stripe_ref,metadata)
    VALUES(v_referrer,v_uid,'registration',v_credits,v_reward_key,jsonb_build_object('journey_id',v_journey_id));
    UPDATE public.viral_referrals SET status='rewarded',rewarded_at=coalesce(rewarded_at,now()),reward_credits=reward_credits+v_credits,updated_at=now() WHERE id=v_journey_id;
    INSERT INTO public.viral_events(journey_id,referrer_id,referred_id,event_name,feature,source,idempotency_key,properties)
    VALUES(v_journey_id,v_referrer,v_uid,'referral_rewarded',v_feature,'registration','reward:registration:'||v_uid::text,jsonb_build_object('credits',v_credits)) ON CONFLICT(idempotency_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok',true,'referrer_id',v_referrer,'journey_id',v_journey_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_viral_referral(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid:=auth.uid(); v_referrer uuid; v_journey_id uuid; v_feature text;
  v_credits integer:=0; v_enabled boolean:=false; v_reward_key text;
BEGIN
  IF v_caller IS NOT NULL AND v_caller<>_user THEN RETURN jsonb_build_object('ok',false,'reason','forbidden'); END IF;
  SELECT referred_by INTO v_referrer FROM public.profiles WHERE id=_user;
  IF v_referrer IS NULL OR v_referrer=_user THEN RETURN jsonb_build_object('ok',false,'reason','no_referrer'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_results WHERE user_id=_user) THEN RETURN jsonb_build_object('ok',false,'reason','not_activated'); END IF;
  SELECT id,feature INTO v_journey_id,v_feature FROM public.viral_referrals WHERE referred_id=_user ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_journey_id IS NULL THEN
    INSERT INTO public.viral_referrals(referrer_id,referred_id,referral_code,feature,source,status,registered_at,activated_at)
    SELECT v_referrer,_user,referral_code,NULL,'activation','activated',created_at,now() FROM public.profiles WHERE id=v_referrer RETURNING id INTO v_journey_id;
  ELSE
    UPDATE public.viral_referrals SET status=CASE WHEN status IN('clicked','registered') THEN 'activated' ELSE status END,activated_at=coalesce(activated_at,now()),updated_at=now() WHERE id=v_journey_id;
  END IF;
  INSERT INTO public.viral_events(journey_id,referrer_id,referred_id,event_name,feature,source,idempotency_key)
  VALUES(v_journey_id,v_referrer,_user,'referral_activation',v_feature,'first_result','activation:'||_user::text) ON CONFLICT(idempotency_key) DO NOTHING;
  SELECT credits,enabled INTO v_credits,v_enabled FROM public.viral_reward_settings WHERE event_key='activation';
  v_reward_key := 'viral:activation:'||_user::text;
  IF coalesce(v_enabled,false) AND coalesce(v_credits,0)>0 AND NOT EXISTS(SELECT 1 FROM public.referral_rewards WHERE stripe_ref=v_reward_key) THEN
    PERFORM public.add_credits(v_referrer,v_credits,'referral_bonus','topup',v_reward_key,jsonb_build_object('kind','activation','referred_user',_user,'journey_id',v_journey_id));
    INSERT INTO public.referral_rewards(referrer_id,referred_id,source,credits,stripe_ref,metadata)
    VALUES(v_referrer,_user,'activation',v_credits,v_reward_key,jsonb_build_object('journey_id',v_journey_id));
    UPDATE public.viral_referrals SET status='rewarded',rewarded_at=coalesce(rewarded_at,now()),reward_credits=reward_credits+v_credits,updated_at=now() WHERE id=v_journey_id;
    INSERT INTO public.viral_events(journey_id,referrer_id,referred_id,event_name,feature,source,idempotency_key,properties)
    VALUES(v_journey_id,v_referrer,_user,'referral_rewarded',v_feature,'activation','reward:activation:'||_user::text,jsonb_build_object('credits',v_credits)) ON CONFLICT(idempotency_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok',true,'journey_id',v_journey_id);
END;
$$;