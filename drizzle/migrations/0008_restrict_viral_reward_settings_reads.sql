REVOKE SELECT ON public.viral_reward_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT (event_key, credits, enabled) ON public.viral_reward_settings TO authenticated;
ALTER POLICY "authenticated read viral reward settings"
  ON public.viral_reward_settings
  USING (
    auth.uid() IS NOT NULL
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
    AND event_key IN ('registration', 'activation')
  );

-- Integration assertions run as part of the security migration.
-- They do not insert, change, or delete application data.
DO $test$
DECLARE
  expected_count bigint;
  actual_count bigint;
BEGIN
  SELECT count(*) INTO expected_count FROM public.viral_reward_settings
    WHERE event_key IN ('registration', 'activation');
  IF expected_count = 0 THEN
    RAISE EXCEPTION 'Referral settings fixture is missing';
  END IF;

  IF has_any_column_privilege('anon', 'public.viral_reward_settings', 'SELECT') THEN
    RAISE EXCEPTION 'Unauthenticated readers must not access reward settings';
  END IF;
  IF has_column_privilege('authenticated', 'public.viral_reward_settings', 'updated_by', 'SELECT')
    OR has_column_privilege('authenticated', 'public.viral_reward_settings', 'updated_at', 'SELECT') THEN
    RAISE EXCEPTION 'Internal reward audit fields must not be readable';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.viral_reward_settings', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Existing server reward management must remain available';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(event_key) INTO actual_count FROM public.viral_reward_settings;
  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'Signed-in users must retain the displayed referral rewards';
  END IF;
  IF EXISTS (SELECT 1 FROM public.viral_reward_settings WHERE event_key NOT IN ('registration', 'activation')) THEN
    RAISE EXCEPTION 'Only the two user-facing reward types may be read';
  END IF;
  BEGIN
    PERFORM updated_by FROM public.viral_reward_settings;
    RAISE EXCEPTION 'Internal audit query unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
  SELECT count(event_key) INTO actual_count FROM public.viral_reward_settings;
  IF actual_count <> 0 THEN
    RAISE EXCEPTION 'Guest sessions must not read reward settings';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  SELECT count(event_key) INTO actual_count FROM public.viral_reward_settings;
  IF actual_count <> 0 THEN
    RAISE EXCEPTION 'Missing user identity must not read reward settings';
  END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$test$;