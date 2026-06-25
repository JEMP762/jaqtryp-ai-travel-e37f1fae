
INSERT INTO public.credit_costs (feature_key, cost, label, description, active)
VALUES ('file_translation', 10, 'Tradução de arquivo', 'Tradução de documento com IA preservando estrutura', true)
ON CONFLICT (feature_key) DO UPDATE SET
  cost = EXCLUDED.cost,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  active = true;

CREATE TABLE public.file_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes int,
  source_lang text,
  target_lang text NOT NULL,
  credits_spent int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','success','error')),
  error_message text,
  storage_path_original text,
  storage_path_translated text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_translations TO authenticated;
GRANT ALL ON public.file_translations TO service_role;

ALTER TABLE public.file_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own file translations"
  ON public.file_translations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX file_translations_user_created_idx
  ON public.file_translations (user_id, created_at DESC);

CREATE TRIGGER file_translations_touch
  BEFORE UPDATE ON public.file_translations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
