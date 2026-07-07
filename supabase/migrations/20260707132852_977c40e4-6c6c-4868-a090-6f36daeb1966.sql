CREATE TABLE IF NOT EXISTS public.live_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  from_user_id text NOT NULL,
  from_name text NOT NULL,
  from_lang text NOT NULL,
  original_text text NOT NULL,
  per_recipient jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_room_messages_room_code_created_at_idx
  ON public.live_room_messages (room_code, created_at);

GRANT SELECT, INSERT ON public.live_room_messages TO anon, authenticated;
GRANT ALL ON public.live_room_messages TO service_role;

ALTER TABLE public.live_room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read live_room_messages"   ON public.live_room_messages;
DROP POLICY IF EXISTS "public insert live_room_messages" ON public.live_room_messages;

CREATE POLICY "public read live_room_messages"
  ON public.live_room_messages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public insert live_room_messages"
  ON public.live_room_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

ALTER TABLE public.live_room_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_room_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_messages';
  END IF;
END$$;