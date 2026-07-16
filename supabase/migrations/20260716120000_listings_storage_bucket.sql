-- Public listing photos bucket + RLS (client uploads to `${auth.uid()}/…`).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listings',
  'listings',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "listings_storage_select_public" ON storage.objects;
CREATE POLICY "listings_storage_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listings');

DROP POLICY IF EXISTS "listings_storage_insert_own" ON storage.objects;
CREATE POLICY "listings_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "listings_storage_update_own" ON storage.objects;
CREATE POLICY "listings_storage_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "listings_storage_delete_own" ON storage.objects;
CREATE POLICY "listings_storage_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
