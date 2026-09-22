INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public',
  'public',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users upload to own folder" ON storage.objects;
CREATE POLICY "Authenticated users upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users update own uploads" ON storage.objects;
CREATE POLICY "Users update own uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'public' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Users delete own uploads" ON storage.objects;
CREATE POLICY "Users delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'public' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Public reads public uploads" ON storage.objects;
CREATE POLICY "Public reads public uploads"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'public');