
-- Add host_user_id to live_room_state so the room "owner" can be charged
ALTER TABLE public.live_room_state
  ADD COLUMN IF NOT EXISTS host_user_id text;

-- Backfill: adopt existing video_host_id as host when set
UPDATE public.live_room_state
   SET host_user_id = video_host_id
 WHERE host_user_id IS NULL AND video_host_id IS NOT NULL;

-- Helper RPC: claim the host slot atomically on first join. Returns the effective host.
CREATE OR REPLACE FUNCTION public.claim_room_host(_code text, _user text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host text;
BEGIN
  INSERT INTO public.live_room_state(room_code, host_user_id)
    VALUES (_code, _user)
    ON CONFLICT (room_code) DO UPDATE
      SET host_user_id = COALESCE(public.live_room_state.host_user_id, EXCLUDED.host_user_id),
          updated_at = now()
    RETURNING host_user_id INTO v_host;
  RETURN v_host;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_room_host(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_room_host(text, text) TO authenticated, service_role;
