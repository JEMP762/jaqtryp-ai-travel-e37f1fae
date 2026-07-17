
CREATE OR REPLACE FUNCTION public.generate_referral_code(_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
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
