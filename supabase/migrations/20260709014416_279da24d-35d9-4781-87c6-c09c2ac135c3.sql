
-- 1) Lock down SECURITY DEFINER functions from anonymous callers
REVOKE EXECUTE ON FUNCTION public.has_premium_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_for_feature(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_monthly_resets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_monthly_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_credits(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_for_feature(uuid, text, jsonb) TO authenticated;

-- 2) Room participants membership table
CREATE TABLE IF NOT EXISTS public.room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_code, user_id)
);
CREATE INDEX IF NOT EXISTS room_participants_code_idx ON public.room_participants(room_code);
CREATE INDEX IF NOT EXISTS room_participants_user_idx ON public.room_participants(user_id);

GRANT SELECT, INSERT, DELETE ON public.room_participants TO authenticated;
GRANT ALL ON public.room_participants TO service_role;

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own membership select" ON public.room_participants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own membership insert" ON public.room_participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own membership delete" ON public.room_participants
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3) Helper to check membership without recursive RLS lookups
CREATE OR REPLACE FUNCTION public.is_room_member(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_code = _code AND user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_room_member(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(text) TO authenticated;

-- 4) Restrict live_room_messages
DROP POLICY IF EXISTS "public read live_room_messages" ON public.live_room_messages;
DROP POLICY IF EXISTS "public insert live_room_messages" ON public.live_room_messages;
REVOKE ALL ON public.live_room_messages FROM anon;
GRANT SELECT ON public.live_room_messages TO authenticated;
GRANT ALL ON public.live_room_messages TO service_role;

CREATE POLICY "members read messages" ON public.live_room_messages
  FOR SELECT TO authenticated
  USING (public.is_room_member(room_code));
-- inserts are performed server-side via service_role only.

-- 5) Restrict live_room_state
DROP POLICY IF EXISTS "public read live_room_state" ON public.live_room_state;
DROP POLICY IF EXISTS "public insert live_room_state" ON public.live_room_state;
DROP POLICY IF EXISTS "public update live_room_state" ON public.live_room_state;
REVOKE ALL ON public.live_room_state FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.live_room_state TO authenticated;
GRANT ALL ON public.live_room_state TO service_role;

CREATE POLICY "members read state" ON public.live_room_state
  FOR SELECT TO authenticated
  USING (public.is_room_member(room_code));
CREATE POLICY "members insert state" ON public.live_room_state
  FOR INSERT TO authenticated
  WITH CHECK (public.is_room_member(room_code));
CREATE POLICY "members update state" ON public.live_room_state
  FOR UPDATE TO authenticated
  USING (public.is_room_member(room_code))
  WITH CHECK (public.is_room_member(room_code));
