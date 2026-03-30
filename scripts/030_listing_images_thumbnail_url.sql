-- Thumbnail URL for listing cards/grids (full-size remains in url).
ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN public.listing_images.thumbnail_url IS 'Smaller WebP for browse cards; url is full resolution for detail views.';
