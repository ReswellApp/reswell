-- Admin listing photo tone. tone_source_url keeps the unedited full object so
-- later saves rebase instead of stacking. Baked files replace url / thumbnail_url.
-- The listing_images trigger refreshes primary_* and tile_gallery_images.

ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS tone_source_url text,
  ADD COLUMN IF NOT EXISTS tone_source_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS tone_brightness smallint,
  ADD COLUMN IF NOT EXISTS tone_highlights smallint,
  ADD COLUMN IF NOT EXISTS tone_shadows smallint,
  ADD COLUMN IF NOT EXISTS tone_contrast smallint;

COMMENT ON COLUMN public.listing_images.tone_source_url IS
  'Unedited full listing photo. Tone saves rebase from this object.';
COMMENT ON COLUMN public.listing_images.tone_source_thumbnail_url IS
  'Thumbnail that belonged to tone_source_url. Restored when tone is cleared.';
COMMENT ON COLUMN public.listing_images.tone_brightness IS
  'Admin brightness stop, -100 to 100. NULL = unchanged.';
COMMENT ON COLUMN public.listing_images.tone_highlights IS
  'Admin highlights stop, -100 to 100. NULL = unchanged.';
COMMENT ON COLUMN public.listing_images.tone_shadows IS
  'Admin shadows stop, -100 to 100. NULL = unchanged.';
COMMENT ON COLUMN public.listing_images.tone_contrast IS
  'Admin contrast stop, -100 to 100. NULL = unchanged.';

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_tone_brightness_range;
ALTER TABLE public.listing_images
  ADD CONSTRAINT listing_images_tone_brightness_range
  CHECK (tone_brightness IS NULL OR tone_brightness BETWEEN -100 AND 100);

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_tone_highlights_range;
ALTER TABLE public.listing_images
  ADD CONSTRAINT listing_images_tone_highlights_range
  CHECK (tone_highlights IS NULL OR tone_highlights BETWEEN -100 AND 100);

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_tone_shadows_range;
ALTER TABLE public.listing_images
  ADD CONSTRAINT listing_images_tone_shadows_range
  CHECK (tone_shadows IS NULL OR tone_shadows BETWEEN -100 AND 100);

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_tone_contrast_range;
ALTER TABLE public.listing_images
  ADD CONSTRAINT listing_images_tone_contrast_range
  CHECK (tone_contrast IS NULL OR tone_contrast BETWEEN -100 AND 100);
