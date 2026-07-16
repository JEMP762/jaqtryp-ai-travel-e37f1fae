
CREATE OR REPLACE FUNCTION public.generate_referral_code(_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
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
END $function$;

REVOKE EXECUTE ON FUNCTION public.has_premium_access(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_for_feature(uuid, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_room_member(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_room_host(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reward_referrer(uuid, text, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_monthly_resets() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_monthly_credits(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_credits(uuid, integer, text, jsonb) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_room_host(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;

CREATE POLICY "members insert messages"
  ON public.live_room_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_room_member(room_code)
    AND from_user_id = auth.uid()::text
  );

CREATE POLICY "host deletes state"
  ON public.live_room_state
  FOR DELETE
  TO authenticated
  USING (host_user_id = auth.uid());

DROP POLICY IF EXISTS "wallet_receipts_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "wallet_receipts_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "wallet_receipts_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "wallet_receipts_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "users read own translation files" ON storage.objects;
DROP POLICY IF EXISTS "users upload own translation files" ON storage.objects;
DROP POLICY IF EXISTS "users delete own translation files" ON storage.objects;

CREATE POLICY "wallet_receipts_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'wallet-receipts'
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wallet_receipts_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wallet-receipts'
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wallet_receipts_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'wallet-receipts'
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wallet_receipts_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'wallet-receipts'
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users read own translation files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'file-translations'
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users upload own translation files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'file-translations'
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users delete own translation files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'file-translations'
    AND coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    AND (storage.foldername(name))[1] = auth.uid()::text);
