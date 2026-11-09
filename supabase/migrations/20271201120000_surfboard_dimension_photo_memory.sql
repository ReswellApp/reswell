-- Surfboard dimension photo memory: labeled listing photos + LLM match attempts.
-- Admins rate Good / Close / Bad; accepted rows grow the reference corpus used as
-- few-shot memory for vision dimension / brand / model fill.

CREATE TABLE IF NOT EXISTS public.surfboard_dimension_photo_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  image_url text NOT NULL,
  thumbnail_url text,
  board_length text NOT NULL,
  board_width_inches text NOT NULL,
  board_thickness_inches text NOT NULL,
  board_volume_l text,
  brand_text text,
  model_text text,
  brand_id uuid,
  brand_model_id uuid,
  dimensions_raw text,
  source text NOT NULL
    CHECK (source IN ('listing_seed', 'match_accepted', 'manual')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surfboard_dimension_photo_refs_length_check
    CHECK (length(trim(board_length)) > 0),
  CONSTRAINT surfboard_dimension_photo_refs_width_check
    CHECK (length(trim(board_width_inches)) > 0),
  CONSTRAINT surfboard_dimension_photo_refs_thickness_check
    CHECK (length(trim(board_thickness_inches)) > 0),
  CONSTRAINT surfboard_dimension_photo_refs_image_check
    CHECK (length(trim(image_url)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS surfboard_dimension_photo_refs_listing_uidx
  ON public.surfboard_dimension_photo_refs (listing_id)
  WHERE listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_refs_active_created_idx
  ON public.surfboard_dimension_photo_refs (active, created_at DESC);

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_refs_length_idx
  ON public.surfboard_dimension_photo_refs (board_length)
  WHERE active = true;

COMMENT ON TABLE public.surfboard_dimension_photo_refs IS
  'Labeled surfboard listing photos with ground-truth dimensions (and optional brand/model). Used as few-shot memory for vision dimension matching.';

CREATE TABLE IF NOT EXISTS public.surfboard_dimension_photo_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  surface text NOT NULL
    CHECK (surface IN ('admin_test', 'sell_photo_match')),
  input_preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  predicted_length text,
  predicted_width text,
  predicted_thickness text,
  predicted_volume text,
  predicted_brand text,
  predicted_model text,
  predicted_confidence text
    CHECK (
      predicted_confidence IS NULL
      OR predicted_confidence IN ('high', 'medium', 'low')
    ),
  predicted_summary text,
  reference_ids uuid[] NOT NULL DEFAULT '{}',
  references_preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_rating text
    CHECK (match_rating IS NULL OR match_rating IN ('good', 'close', 'bad')),
  corrected_length text,
  corrected_width text,
  corrected_thickness text,
  corrected_volume text,
  corrected_brand text,
  corrected_model text,
  rating_note text,
  rated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  rated_at timestamptz,
  promoted_ref_id uuid REFERENCES public.surfboard_dimension_photo_refs (id) ON DELETE SET NULL,
  listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_occurred_idx
  ON public.surfboard_dimension_photo_matches (occurred_at DESC);

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_unrated_idx
  ON public.surfboard_dimension_photo_matches (occurred_at DESC)
  WHERE match_rating IS NULL;

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_rated_idx
  ON public.surfboard_dimension_photo_matches (rated_at DESC)
  WHERE rated_at IS NOT NULL;

COMMENT ON TABLE public.surfboard_dimension_photo_matches IS
  'One row per LLM dimension-photo match. Admin Good/Close/Bad ratings and corrections become few-shot memory and can promote into the reference corpus.';

ALTER TABLE public.surfboard_dimension_photo_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surfboard_dimension_photo_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "surfboard_dimension_photo_refs_select_staff"
  ON public.surfboard_dimension_photo_refs;
CREATE POLICY "surfboard_dimension_photo_refs_select_staff"
  ON public.surfboard_dimension_photo_refs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "surfboard_dimension_photo_refs_write_admin"
  ON public.surfboard_dimension_photo_refs;
CREATE POLICY "surfboard_dimension_photo_refs_write_admin"
  ON public.surfboard_dimension_photo_refs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "surfboard_dimension_photo_matches_select_staff"
  ON public.surfboard_dimension_photo_matches;
CREATE POLICY "surfboard_dimension_photo_matches_select_staff"
  ON public.surfboard_dimension_photo_matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "surfboard_dimension_photo_matches_write_admin"
  ON public.surfboard_dimension_photo_matches;
CREATE POLICY "surfboard_dimension_photo_matches_write_admin"
  ON public.surfboard_dimension_photo_matches
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
