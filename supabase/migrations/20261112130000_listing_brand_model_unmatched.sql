-- Companion to listing_brand_model_autofills: tracks active listings whose title
-- the daily backfill cron could NOT match to a directory brand and/or catalog model.
-- One row per listing (self-healing: cleared once a match is found on a later run),
-- so admins have a worklist of brands/models to add to the catalog.

CREATE TABLE IF NOT EXISTS public.listing_brand_model_unmatched (
  listing_id uuid PRIMARY KEY REFERENCES public.listings (id) ON DELETE CASCADE,
  listing_title text,
  needs_brand boolean NOT NULL DEFAULT false,
  needs_model boolean NOT NULL DEFAULT false,
  -- Brand the listing is (or was matched to) when only the model is missing —
  -- tells the admin which brand to add the model under.
  matched_brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  matched_brand_name text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_brand_model_unmatched_last_seen_idx
  ON public.listing_brand_model_unmatched (last_seen_at DESC);

COMMENT ON TABLE public.listing_brand_model_unmatched IS
  'Active listings whose title the backfill cron could not match to a catalog brand/model. Worklist for adding missing brands/models; cleared automatically when a match is later found.';

ALTER TABLE public.listing_brand_model_unmatched ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_brand_model_unmatched_select_staff" ON public.listing_brand_model_unmatched;
CREATE POLICY "listing_brand_model_unmatched_select_staff" ON public.listing_brand_model_unmatched
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );
