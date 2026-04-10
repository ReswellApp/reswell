-- Homepage hero slideshow: optional curated images (fallback to static files when empty).

CREATE TABLE IF NOT EXISTS public.home_hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_hero_slides_sort_idx ON public.home_hero_slides (sort_order, created_at);

ALTER TABLE public.home_hero_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_hero_slides_select_public" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_select_public" ON public.home_hero_slides FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_hero_slides_insert_admin" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_insert_admin" ON public.home_hero_slides FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_hero_slides_update_admin" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_update_admin" ON public.home_hero_slides FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_hero_slides_delete_admin" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_delete_admin" ON public.home_hero_slides FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

-- Large hero imagery — read by anyone, write by marketplace admins only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "site_assets_select_public" ON storage.objects;
CREATE POLICY "site_assets_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "site_assets_insert_admin" ON storage.objects;
CREATE POLICY "site_assets_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "site_assets_update_admin" ON storage.objects;
CREATE POLICY "site_assets_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'site-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "site_assets_delete_admin" ON storage.objects;
CREATE POLICY "site_assets_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'site-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
