-- Mirror of supabase/migrations/20260424120000_brand_requests_expand_storage.sql

ALTER TABLE public.brand_requests
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS founder_name text,
  ADD COLUMN IF NOT EXISTS lead_shaper_name text,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS about_paragraphs text[],
  ADD COLUMN IF NOT EXISTS logo_url text;

UPDATE public.brand_requests SET about_paragraphs = ARRAY[]::text[] WHERE about_paragraphs IS NULL;
ALTER TABLE public.brand_requests ALTER COLUMN about_paragraphs SET DEFAULT ARRAY[]::text[];
ALTER TABLE public.brand_requests ALTER COLUMN about_paragraphs SET NOT NULL;

UPDATE public.brand_requests SET status = 'pending' WHERE status IS NULL;
ALTER TABLE public.brand_requests ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.brand_requests ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.brand_requests DROP CONSTRAINT IF EXISTS brand_requests_status_check;
ALTER TABLE public.brand_requests ADD CONSTRAINT brand_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-request-logos',
  'brand-request-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "brand_request_logos_select_public" ON storage.objects;
CREATE POLICY "brand_request_logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-request-logos');

DROP POLICY IF EXISTS "brand_request_logos_insert_own" ON storage.objects;
CREATE POLICY "brand_request_logos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-request-logos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "brand_request_logos_update_own" ON storage.objects;
CREATE POLICY "brand_request_logos_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-request-logos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'brand-request-logos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "brand_request_logos_delete_own" ON storage.objects;
CREATE POLICY "brand_request_logos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-request-logos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
