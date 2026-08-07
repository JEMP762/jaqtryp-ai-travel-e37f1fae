CREATE TABLE public.mystifly_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  environment text NOT NULL DEFAULT 'sandbox',
  timeout_ms integer NOT NULL DEFAULT 30000,
  max_retries integer NOT NULL DEFAULT 2,
  cache_ttl_seconds integer NOT NULL DEFAULT 900,
  connection_status text NOT NULL DEFAULT 'unknown',
  connection_message text,
  last_sync_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mystifly_settings TO authenticated;
GRANT ALL ON public.mystifly_settings TO service_role;

ALTER TABLE public.mystifly_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mystifly_settings_admin_read" ON public.mystifly_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mystifly_settings_admin_insert" ON public.mystifly_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mystifly_settings_admin_update" ON public.mystifly_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER mystifly_settings_touch
  BEFORE UPDATE ON public.mystifly_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.mystifly_settings (singleton) VALUES (true);

CREATE TABLE public.mystifly_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  duration_ms integer,
  http_status integer,
  success boolean NOT NULL DEFAULT false,
  error text,
  user_id uuid,
  trip_id text,
  booking_id text,
  mf_reference text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mystifly_api_logs_created_at_idx ON public.mystifly_api_logs (created_at DESC);
CREATE INDEX mystifly_api_logs_endpoint_idx ON public.mystifly_api_logs (endpoint);

GRANT SELECT ON public.mystifly_api_logs TO authenticated;
GRANT ALL ON public.mystifly_api_logs TO service_role;

ALTER TABLE public.mystifly_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mystifly_api_logs_admin_read" ON public.mystifly_api_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));