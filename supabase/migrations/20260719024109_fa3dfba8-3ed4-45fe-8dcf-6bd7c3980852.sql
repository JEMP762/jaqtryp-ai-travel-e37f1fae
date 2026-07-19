
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('flight','stay')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_value NUMERIC,
  currency TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX affiliate_clicks_user_idx ON public.affiliate_clicks(user_id, clicked_at DESC);
CREATE INDEX affiliate_clicks_partner_idx ON public.affiliate_clicks(partner, clicked_at DESC);

GRANT SELECT, INSERT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aff_clicks_insert_own"
  ON public.affiliate_clicks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "aff_clicks_select_own"
  ON public.affiliate_clicks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "aff_clicks_admin_read"
  ON public.affiliate_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
