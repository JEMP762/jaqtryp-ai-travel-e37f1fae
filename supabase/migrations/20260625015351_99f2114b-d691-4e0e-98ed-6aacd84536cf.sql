
CREATE POLICY "users read own translation files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'file-translations' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users upload own translation files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'file-translations' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own translation files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'file-translations' AND auth.uid()::text = (storage.foldername(name))[1]);
