-- Optional listing product videos (max 1 enforced in app) for /sell + Meta/Google catalog ads.
-- Stored in the public `listings` bucket alongside photos; bucket MIME/size raised for video.

UPDATE storage.buckets
SET
  file_size_limit = 209715200,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
WHERE id = 'listings';

CREATE TABLE IF NOT EXISTS public.listing_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  content_type TEXT,
  duration_seconds DOUBLE PRECISION,
  byte_size BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_videos_listing_id_sort_idx
  ON public.listing_videos (listing_id, sort_order);

COMMENT ON TABLE public.listing_videos IS
  'Optional product videos for peer listings (sell flow + Meta/Google catalog feeds).';
COMMENT ON COLUMN public.listing_videos.thumbnail_url IS
  'Optional poster frame (WebP/JPEG) captured client-side for PDP thumbs.';
COMMENT ON COLUMN public.listing_videos.url IS
  'Public listings-bucket video URL (mp4/mov/webm). Direct file URL for ad catalogs.';

ALTER TABLE public.listing_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_videos_select_public" ON public.listing_videos;
CREATE POLICY "listing_videos_select_public" ON public.listing_videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id
        AND (
          l.status IS DISTINCT FROM 'draft'
          OR l.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
          )
        )
    )
  );

DROP POLICY IF EXISTS "listing_videos_insert_own" ON public.listing_videos;
CREATE POLICY "listing_videos_insert_own" ON public.listing_videos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE id = listing_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "listing_videos_update_own" ON public.listing_videos;
CREATE POLICY "listing_videos_update_own" ON public.listing_videos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE id = listing_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE id = listing_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "listing_videos_delete_own" ON public.listing_videos;
CREATE POLICY "listing_videos_delete_own" ON public.listing_videos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE id = listing_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "listing_videos_insert_admin" ON public.listing_videos;
CREATE POLICY "listing_videos_insert_admin" ON public.listing_videos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
  );
