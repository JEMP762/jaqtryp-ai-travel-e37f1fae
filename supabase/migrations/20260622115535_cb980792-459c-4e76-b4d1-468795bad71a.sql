
REVOKE EXECUTE ON FUNCTION public.spend_credits(uuid, int, text, jsonb) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, int, text, text, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, int, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, int, text, text, jsonb) TO service_role;
