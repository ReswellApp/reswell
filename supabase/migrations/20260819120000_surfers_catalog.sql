-- Surfer profiles (public directory + admin CMS)

CREATE TABLE IF NOT EXISTS public.surfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_description text,
  instagram_url text,
  youtube_url text,
  photo_url text,
  location_label text,
  about_paragraphs text[] NOT NULL DEFAULT '{}',
  quiver_image_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS surfers_slug_idx ON public.surfers (slug);

ALTER TABLE public.surfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "surfers_select_public" ON public.surfers;
CREATE POLICY "surfers_select_public" ON public.surfers FOR SELECT USING (true);

DROP POLICY IF EXISTS "surfers_insert_admin" ON public.surfers;
CREATE POLICY "surfers_insert_admin" ON public.surfers FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "surfers_update_admin" ON public.surfers;
CREATE POLICY "surfers_update_admin" ON public.surfers FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "surfers_delete_admin" ON public.surfers;
CREATE POLICY "surfers_delete_admin" ON public.surfers FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

-- Headshots — public read, marketplace admins only for writes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'surfer-assets',
  'surfer-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "surfer_assets_select_public" ON storage.objects;
CREATE POLICY "surfer_assets_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'surfer-assets');

DROP POLICY IF EXISTS "surfer_assets_insert_admin" ON storage.objects;
CREATE POLICY "surfer_assets_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'surfer-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "surfer_assets_update_admin" ON storage.objects;
CREATE POLICY "surfer_assets_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'surfer-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "surfer_assets_delete_admin" ON storage.objects;
CREATE POLICY "surfer_assets_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'surfer-assets'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
