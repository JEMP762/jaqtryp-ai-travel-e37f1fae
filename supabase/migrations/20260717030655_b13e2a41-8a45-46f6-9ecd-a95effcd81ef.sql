-- 1) Revoke public/anon EXECUTE on trigger-only SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.set_referral_code_on_profile() FROM PUBLIC, anon;

-- 2) Prevent anonymous (guest) sign-ins from reaching wallets even though the
-- policy targets `authenticated` — anonymous users authenticate as that role.
DROP POLICY IF EXISTS wallets_own ON public.wallets;
CREATE POLICY wallets_own ON public.wallets
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  WITH CHECK (
    auth.uid() = user_id
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- 3) Let referred users see their own reward rows (fail-closed today).
CREATE POLICY referral_rewards_referred_select ON public.referral_rewards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = referred_id);