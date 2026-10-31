-- Admin Exclude: do not rematch / re-scan this case; feed "skip similar" memory.

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS excluded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.excluded_at IS
  'When set, skip this match (and its listing) for rematch/scan. Used as exclude-memory for similar cases.';

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_excluded_idx
  ON public.surfboard_dimension_photo_matches (excluded_at DESC)
  WHERE excluded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_listing_excluded_idx
  ON public.surfboard_dimension_photo_matches (listing_id)
  WHERE excluded_at IS NOT NULL AND listing_id IS NOT NULL;
