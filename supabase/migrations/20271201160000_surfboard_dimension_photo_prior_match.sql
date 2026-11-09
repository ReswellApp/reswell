-- Link rematch runs to the prior rated match so history is preserved.
-- Bad/Close matches stay in place; a new unrated row is inserted with prior_match_id.

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS prior_match_id uuid
    REFERENCES public.surfboard_dimension_photo_matches (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.prior_match_id IS
  'When set, this row is a rematch of a prior Bad/Close (or otherwise re-run) match. Both rows are kept.';

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_prior_match_idx
  ON public.surfboard_dimension_photo_matches (prior_match_id)
  WHERE prior_match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_listing_occurred_idx
  ON public.surfboard_dimension_photo_matches (listing_id, occurred_at DESC)
  WHERE listing_id IS NOT NULL;
