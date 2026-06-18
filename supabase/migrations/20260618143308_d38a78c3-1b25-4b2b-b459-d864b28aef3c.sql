
-- 1) Storage RLS for the private `wallet-receipts` bucket
-- Enforce per-user folder layout: object name must start with `<auth.uid()>/`
DROP POLICY IF EXISTS "wallet_receipts_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "wallet_receipts_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "wallet_receipts_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "wallet_receipts_owner_delete" ON storage.objects;

CREATE POLICY "wallet_receipts_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'wallet-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "wallet_receipts_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wallet-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "wallet_receipts_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'wallet-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'wallet-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "wallet_receipts_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'wallet-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2) Block any client-side UPDATE on pending_flight_bookings.
-- The service-role webhook bypasses RLS, so this only prevents the
-- authenticated/anon API from ever mutating payment_status or amounts.
DROP POLICY IF EXISTS "pfb_block_updates" ON public.pending_flight_bookings;
CREATE POLICY "pfb_block_updates"
ON public.pending_flight_bookings
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);
