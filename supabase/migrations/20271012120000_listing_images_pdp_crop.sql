-- Per-photo crop for /l listing heroes only. Browse tiles keep using
-- primary_* / tile_gallery_images and never read these columns.

ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS pdp_crop_zoom numeric,
  ADD COLUMN IF NOT EXISTS pdp_crop_x numeric,
  ADD COLUMN IF NOT EXISTS pdp_crop_y numeric;

COMMENT ON COLUMN public.listing_images.pdp_crop_zoom IS
  'PDP hero zoom. 0 = contain (full photo), 1 = cover, >1 extra zoom. NULL = default cover.';
COMMENT ON COLUMN public.listing_images.pdp_crop_x IS
  'PDP hero focal X percent (0-100). NULL = 50.';
COMMENT ON COLUMN public.listing_images.pdp_crop_y IS
  'PDP hero focal Y percent (0-100). NULL = 50.';

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_pdp_crop_zoom_range;
ALTER TABLE public.listing_images
  ADD CONSTRAINT listing_images_pdp_crop_zoom_range
  CHECK (pdp_crop_zoom IS NULL OR (pdp_crop_zoom >= 0 AND pdp_crop_zoom <= 4));

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_pdp_crop_x_range;
ALTER TABLE public.listing_images
  ADD CONSTRAINT listing_images_pdp_crop_x_range
  CHECK (pdp_crop_x IS NULL OR (pdp_crop_x >= 0 AND pdp_crop_x <= 100));

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_pdp_crop_y_range;
ALTER TABLE public.listing_images
  ADD CONSTRAINT listing_images_pdp_crop_y_range
  CHECK (pdp_crop_y IS NULL OR (pdp_crop_y >= 0 AND pdp_crop_y <= 100));
