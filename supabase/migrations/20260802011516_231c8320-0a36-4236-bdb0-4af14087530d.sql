CREATE TABLE IF NOT EXISTS public.user_branding (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  logo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branding TO authenticated;
GRANT ALL ON public.user_branding TO service_role;

ALTER TABLE public.user_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_branding_own" ON public.user_branding
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_branding_updated_at ON public.user_branding;
CREATE TRIGGER trg_user_branding_updated_at
  BEFORE UPDATE ON public.user_branding
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies: each user only inside their own folder
CREATE POLICY "brand_logos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand_logos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand_logos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand_logos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.credit_costs (feature_key, cost, label, description, active)
VALUES ('trip_create_branded', 25, 'Roteiro com logo', 'Roteiro completo com a logo da empresa no cabeçalho e no PDF', true)
ON CONFLICT (feature_key) DO UPDATE SET cost = EXCLUDED.cost, label = EXCLUDED.label, description = EXCLUDED.description, active = true;