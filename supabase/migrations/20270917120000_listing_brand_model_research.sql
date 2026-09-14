-- Research / review fields for listings the brand/model backfill cron could not
-- attach from the existing catalog. Low-confidence candidates stay queued;
-- high-confidence research writes proposed names + notes before create/attach.

ALTER TABLE public.listing_brand_model_unmatched
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'unmatched',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS proposed_brand_name text,
  ADD COLUMN IF NOT EXISTS proposed_model_name text,
  ADD COLUMN IF NOT EXISTS research_notes text,
  ADD COLUMN IF NOT EXISTS last_researched_at timestamptz;

ALTER TABLE public.listing_brand_model_unmatched
  DROP CONSTRAINT IF EXISTS listing_brand_model_unmatched_review_status_check;

ALTER TABLE public.listing_brand_model_unmatched
  ADD CONSTRAINT listing_brand_model_unmatched_review_status_check
  CHECK (review_status IN ('unmatched', 'needs_review'));

CREATE INDEX IF NOT EXISTS listing_brand_model_unmatched_review_idx
  ON public.listing_brand_model_unmatched (review_status, last_researched_at);

COMMENT ON COLUMN public.listing_brand_model_unmatched.review_status IS
  'unmatched = still unresolved; needs_review = cron would not invent a brand/model.';
COMMENT ON COLUMN public.listing_brand_model_unmatched.review_reason IS
  'Stable machine reason (no_extractable_brand, low_confidence, unofficial_source, …).';
COMMENT ON COLUMN public.listing_brand_model_unmatched.proposed_brand_name IS
  'Extracted or researched brand label for staff review — not applied when confidence is low.';
COMMENT ON COLUMN public.listing_brand_model_unmatched.proposed_model_name IS
  'Extracted or researched model label for staff review.';
COMMENT ON COLUMN public.listing_brand_model_unmatched.research_notes IS
  'Short human-readable note from the research pass (site, skip reason).';
COMMENT ON COLUMN public.listing_brand_model_unmatched.last_researched_at IS
  'When the cron last attempted research for this listing. Used as a cooldown.';

ALTER TABLE public.listing_brand_model_autofills
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'title_backfill';

ALTER TABLE public.listing_brand_model_autofills
  DROP CONSTRAINT IF EXISTS listing_brand_model_autofills_source_check;

ALTER TABLE public.listing_brand_model_autofills
  ADD CONSTRAINT listing_brand_model_autofills_source_check
  CHECK (source IN ('title_backfill', 'label_backfill', 'research_create'));

COMMENT ON COLUMN public.listing_brand_model_autofills.source IS
  'title_backfill = catalog name in title; label_backfill = seller brand/model fields; research_create = confirmed-missing catalog row created then attached.';
