-- Legacy bucket id (superseded for uploads by `blog-images` in 20260801120700_blog_images_storage.sql).
-- Kept so older migration timelines stay reproducible.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-media',
  'blog-media',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "blog_media_select_public" ON storage.objects;
CREATE POLICY "blog_media_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-media');

DROP POLICY IF EXISTS "blog_media_insert_admin" ON storage.objects;
CREATE POLICY "blog_media_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'blog-media'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "blog_media_update_admin" ON storage.objects;
CREATE POLICY "blog_media_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'blog-media'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "blog_media_delete_admin" ON storage.objects;
CREATE POLICY "blog_media_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'blog-media'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
