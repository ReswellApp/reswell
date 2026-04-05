-- Admin CRUD on brands + public logo uploads for admins only.

CREATE POLICY "brands_insert_admin" ON public.brands FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

CREATE POLICY "brands_update_admin" ON public.brands FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

CREATE POLICY "brands_delete_admin" ON public.brands FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

-- Public catalog images (logos) — read by anyone, write by marketplace admins only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "brand_assets_select_public" ON storage.objects;
CREATE POLICY "brand_assets_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "brand_assets_insert_admin" ON storage.objects;
CREATE POLICY "brand_assets_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "brand_assets_update_admin" ON storage.objects;
CREATE POLICY "brand_assets_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "brand_assets_delete_admin" ON storage.objects;
CREATE POLICY "brand_assets_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
