-- Dimension photo matches store which listing photo the LLM read dimensions from.
-- Listing scans learn from images only — never copy listings.dimensions.

ALTER TABLE public.surfboard_dimension_photo_matches
  DROP CONSTRAINT IF EXISTS surfboard_dimension_photo_matches_surface_check;

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD CONSTRAINT surfboard_dimension_photo_matches_surface_check
  CHECK (surface IN ('admin_test', 'sell_photo_match', 'listing_scan'));

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS source_image_url text;

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.source_image_url IS
  'The listing photo the model identified as containing the printed dimensions (size stamp / stringer / label).';

ALTER TABLE public.surfboard_dimension_photo_refs
  DROP CONSTRAINT IF EXISTS surfboard_dimension_photo_refs_source_check;

ALTER TABLE public.surfboard_dimension_photo_refs
  ADD CONSTRAINT surfboard_dimension_photo_refs_source_check
  CHECK (source IN ('listing_seed', 'match_accepted', 'manual', 'listing_scan'));

COMMENT ON TABLE public.surfboard_dimension_photo_refs IS
  'Vision-discovered surfboard dimension photos (image where dims were read + L×W×T). Grown only from admin-accepted LLM reads — not from listings.dimensions.';
