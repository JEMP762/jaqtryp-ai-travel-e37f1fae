CREATE TABLE public.trip_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  headline text,
  intro text,
  allowed_domains text[] NOT NULL DEFAULT '{}',
  max_per_hour integer NOT NULL DEFAULT 5,
  max_per_day integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX trip_widgets_owner_unique ON public.trip_widgets(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_widgets TO authenticated;
GRANT ALL ON public.trip_widgets TO service_role;

ALTER TABLE public.trip_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_widgets_owner_all" ON public.trip_widgets
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trip_widgets_touch
  BEFORE UPDATE ON public.trip_widgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.trip_widget_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL REFERENCES public.trip_widgets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination text NOT NULL,
  days integer NOT NULL,
  credits_spent integer NOT NULL DEFAULT 0,
  visitor_hash text,
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trip_widget_generations_widget_time ON public.trip_widget_generations(widget_id, created_at DESC);
CREATE INDEX trip_widget_generations_visitor ON public.trip_widget_generations(widget_id, visitor_hash, created_at DESC);

GRANT SELECT ON public.trip_widget_generations TO authenticated;
GRANT ALL ON public.trip_widget_generations TO service_role;

ALTER TABLE public.trip_widget_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_widget_generations_owner_read" ON public.trip_widget_generations
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.get_public_trip_widget(_slug text)
RETURNS TABLE (slug text, headline text, intro text, company_name text, logo_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT w.slug, w.headline, w.intro, b.company_name, b.logo_path
    FROM public.trip_widgets w
    LEFT JOIN public.user_branding b ON b.user_id = w.owner_id
   WHERE w.slug = lower(_slug) AND w.active = true
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_trip_widget(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_trip_widget(text) TO service_role;