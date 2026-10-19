-- Non-destructive listing photo tone, in the Photos / Lightroom shape.
-- The uploaded file stays the original. This table is the recipe. On save the
-- server bakes a new full/thumb/card/film set and points listing_images at it.
-- Revert deletes the recipe and the rendition, and points the listing back.

ALTER TABLE public.listing_images
  DROP CONSTRAINT IF EXISTS listing_images_tone_brightness_range,
  DROP CONSTRAINT IF EXISTS listing_images_tone_highlights_range,
  DROP CONSTRAINT IF EXISTS listing_images_tone_shadows_range,
  DROP CONSTRAINT IF EXISTS listing_images_tone_contrast_range;

ALTER TABLE public.listing_images
  DROP COLUMN IF EXISTS tone_source_url,
  DROP COLUMN IF EXISTS tone_source_thumbnail_url,
  DROP COLUMN IF EXISTS tone_brightness,
  DROP COLUMN IF EXISTS tone_highlights,
  DROP COLUMN IF EXISTS tone_shadows,
  DROP COLUMN IF EXISTS tone_contrast;

CREATE TABLE IF NOT EXISTS public.listing_image_adjustments (
  image_id uuid PRIMARY KEY REFERENCES public.listing_images (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_thumbnail_url text,
  rendition_url text NOT NULL,
  rendition_thumbnail_url text,
  brightness smallint NOT NULL DEFAULT 0,
  highlights smallint NOT NULL DEFAULT 0,
  shadows smallint NOT NULL DEFAULT 0,
  contrast smallint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_image_adjustments_brightness_range
    CHECK (brightness BETWEEN -100 AND 100),
  CONSTRAINT listing_image_adjustments_highlights_range
    CHECK (highlights BETWEEN -100 AND 100),
  CONSTRAINT listing_image_adjustments_shadows_range
    CHECK (shadows BETWEEN -100 AND 100),
  CONSTRAINT listing_image_adjustments_contrast_range
    CHECK (contrast BETWEEN -100 AND 100),
  CONSTRAINT listing_image_adjustments_has_change
    CHECK (brightness <> 0 OR highlights <> 0 OR shadows <> 0 OR contrast <> 0)
);

CREATE INDEX IF NOT EXISTS listing_image_adjustments_listing_id_idx
  ON public.listing_image_adjustments (listing_id);

COMMENT ON TABLE public.listing_image_adjustments IS
  'Tone recipe for one listing photo. source_url is the untouched upload. rendition_url is the baked copy listing_images.url points at while the recipe is current.';
COMMENT ON COLUMN public.listing_image_adjustments.source_url IS
  'Original full listing photo. Never overwritten.';
COMMENT ON COLUMN public.listing_image_adjustments.rendition_url IS
  'Baked full photo buyers are served. A new URL on every save.';

ALTER TABLE public.listing_image_adjustments ENABLE ROW LEVEL SECURITY;
