-- Split admin ratings: photo pick vs dimensions read.

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS photo_rating text
    CHECK (photo_rating IS NULL OR photo_rating IN ('good', 'close', 'bad'));

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS dims_rating text
    CHECK (dims_rating IS NULL OR dims_rating IN ('good', 'close', 'bad'));

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.photo_rating IS
  'Admin rating of whether the model picked the correct dimensions photo.';

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.dims_rating IS
  'Admin rating of whether the model read L×W×T correctly from that photo.';

-- Backfill from the old single match_rating when present.
UPDATE public.surfboard_dimension_photo_matches
SET
  photo_rating = COALESCE(photo_rating, match_rating),
  dims_rating = COALESCE(dims_rating, match_rating)
WHERE match_rating IS NOT NULL
  AND (photo_rating IS NULL OR dims_rating IS NULL);

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_photo_rating_idx
  ON public.surfboard_dimension_photo_matches (occurred_at DESC)
  WHERE photo_rating IS NULL OR dims_rating IS NULL;
