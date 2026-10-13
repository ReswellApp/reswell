-- Admin listing photo tone. See supabase/migrations/20271024120000_listing_images_photo_tone.sql.

ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS tone_source_url text,
  ADD COLUMN IF NOT EXISTS tone_source_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS tone_brightness smallint,
  ADD COLUMN IF NOT EXISTS tone_highlights smallint,
  ADD COLUMN IF NOT EXISTS tone_shadows smallint,
  ADD COLUMN IF NOT EXISTS tone_contrast smallint;

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
