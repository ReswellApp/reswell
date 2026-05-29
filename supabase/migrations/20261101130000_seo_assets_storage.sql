-- Public storage bucket for SEO share images (Open Graph / social previews) uploaded from the
-- admin SEO panel. Read by anyone (crawlers fetch the public URL); write by marketplace admins only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seo-assets',
  'seo-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "seo_assets_select_public" ON storage.objects;
CREATE POLICY "seo_assets_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seo-assets');

DROP POLICY IF EXISTS "seo_assets_insert_admin" ON storage.objects;
CREATE POLICY "seo_assets_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'seo-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "seo_assets_update_admin" ON storage.objects;
CREATE POLICY "seo_assets_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'seo-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "seo_assets_delete_admin" ON storage.objects;
CREATE POLICY "seo_assets_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'seo-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
