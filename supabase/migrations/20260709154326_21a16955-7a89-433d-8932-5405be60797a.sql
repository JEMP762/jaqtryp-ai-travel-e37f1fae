DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'live_room_state'
       AND column_name = 'host_user_id'
  ) THEN
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'live_room_state'
         AND column_name = 'host_user_id'
         AND udt_name <> 'uuid'
    ) THEN
      ALTER TABLE public.live_room_state
        ALTER COLUMN host_user_id TYPE uuid
        USING CASE
          WHEN host_user_id IS NULL THEN NULL
          WHEN host_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN host_user_id::uuid
          ELSE NULL
        END;
    END IF;
  ELSE
    ALTER TABLE public.live_room_state
      ADD COLUMN host_user_id uuid;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.claim_room_host(text, text);
DROP FUNCTION IF EXISTS public.claim_room_host(text);

CREATE OR REPLACE FUNCTION public.claim_room_host(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_host uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.room_participants
     WHERE room_code = _code
       AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Join the room before claiming host';
  END IF;

  INSERT INTO public.live_room_state(room_code, host_user_id)
    VALUES (_code, v_user)
    ON CONFLICT (room_code) DO UPDATE
      SET host_user_id = COALESCE(public.live_room_state.host_user_id, EXCLUDED.host_user_id),
          updated_at = now()
    RETURNING host_user_id INTO v_host;

  RETURN v_host;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_room_host(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_room_host(text) TO authenticated, service_role;