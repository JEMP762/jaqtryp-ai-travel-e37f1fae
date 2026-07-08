CREATE TABLE IF NOT EXISTS public.live_room_state (
  room_code text PRIMARY KEY,
  call_mode text NOT NULL DEFAULT 'none' CHECK (call_mode IN ('none', 'audio', 'video')),
  video_host_id text,
  daily_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.live_room_state TO anon, authenticated;
GRANT ALL ON public.live_room_state TO service_role;

ALTER TABLE public.live_room_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read live_room_state" ON public.live_room_state;
DROP POLICY IF EXISTS "public insert live_room_state" ON public.live_room_state;
DROP POLICY IF EXISTS "public update live_room_state" ON public.live_room_state;

CREATE POLICY "public read live_room_state"
  ON public.live_room_state FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public insert live_room_state"
  ON public.live_room_state FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "public update live_room_state"
  ON public.live_room_state FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_live_room_state_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_live_room_state_updated_at ON public.live_room_state;
CREATE TRIGGER touch_live_room_state_updated_at
  BEFORE UPDATE ON public.live_room_state
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_live_room_state_updated_at();

ALTER TABLE public.live_room_state REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_room_state'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_state';
  END IF;
END$$;