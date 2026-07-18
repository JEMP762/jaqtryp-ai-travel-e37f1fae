-- Ensure pgcrypto in extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Grant execute on spend_for_feature to authenticated users (client-side RPC)
GRANT EXECUTE ON FUNCTION public.spend_for_feature(uuid, text, jsonb) TO authenticated;

-- Recreate generate_referral_code with fully qualified reference and safe search_path
CREATE OR REPLACE FUNCTION public.generate_referral_code(_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_code text;
  v_try int := 0;
BEGIN
  LOOP
    v_code := upper(substr(replace(encode(extensions.gen_random_bytes(6), 'base64'), '/', ''), 1, 8));
    v_code := regexp_replace(v_code, '[^A-Z0-9]', 'X', 'g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
    v_try := v_try + 1;
    IF v_try > 10 THEN
      v_code := upper(substr(replace(_uid::text,'-',''),1,8));
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END $function$;

-- Recreate set_referral_code_on_profile with same search_path
CREATE OR REPLACE FUNCTION public.set_referral_code_on_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code(NEW.id);
  END IF;
  RETURN NEW;
END $function$;

-- Recreate handle_new_user with safe search_path including extensions
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name',
                     NEW.raw_user_meta_data->>'name',
                     split_part(NEW.email,'@',1)),
            NEW.raw_user_meta_data->>'avatar_url')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profiles: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'free') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user user_roles: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_credits (user_id, free_balance, lifetime_purchased)
    VALUES (NEW.id, 100, 0)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
    VALUES (NEW.id, 100, 'signup_bonus',
            '{"bucket":"free","note":"Welcome bonus"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user credits: %', SQLERRM;
  END;

  RETURN NEW;
END $function$;