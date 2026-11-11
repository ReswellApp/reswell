-- Indexed few-shot memory for dimension-photo matching.
-- Ratings (Good / Close / Bad / Exclude) are upserted here so the next vision
-- call can retrieve similar examples by perceptual hash + kind, instead of
-- only stuffing the last N rows into the prompt. This is not a weight
-- fine-tune — the LLM still reads the retrieved examples in-context.

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS corrected_source_image_url text;

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS stamp_box jsonb;

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.corrected_source_image_url IS
  'Admin-picked stamp photo when the model chose the wrong gallery frame. Indexed as a GOOD photo example; the model pick stays on source_image_url as BAD.';

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.stamp_box IS
  'Normalized stamp crop {x,y,width,height} in 0–1 of the picked photo. Used to OCR a tight crop instead of the full listing shot.';

CREATE TABLE IF NOT EXISTS public.surfboard_dimension_photo_memory_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.surfboard_dimension_photo_matches (id) ON DELETE CASCADE,
  ref_id uuid REFERENCES public.surfboard_dimension_photo_refs (id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (
      kind IN (
        'photo_good',
        'photo_bad',
        'dims_good',
        'dims_close',
        'dims_bad',
        'exclude'
      )
    ),
  failure_mode text,
  stamp_style text,
  length_band text,
  image_url text NOT NULL,
  phash text,
  caption text NOT NULL,
  predicted_length text,
  predicted_width text,
  predicted_thickness text,
  predicted_volume text,
  actual_length text,
  actual_width text,
  actual_thickness text,
  actual_volume text,
  rating_note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surfboard_dimension_photo_memory_index_image_check
    CHECK (length(trim(image_url)) > 0),
  CONSTRAINT surfboard_dimension_photo_memory_index_caption_check
    CHECK (length(trim(caption)) > 0),
  CONSTRAINT surfboard_dimension_photo_memory_index_phash_check
    CHECK (phash IS NULL OR phash ~ '^[0-9a-f]{16}$'),
  CONSTRAINT surfboard_dimension_photo_memory_index_match_kind_uidx
    UNIQUE (match_id, kind)
);

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_memory_index_kind_updated_idx
  ON public.surfboard_dimension_photo_memory_index (kind, active, updated_at DESC);

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_memory_index_phash_idx
  ON public.surfboard_dimension_photo_memory_index (phash)
  WHERE active = true AND phash IS NOT NULL;

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_memory_index_failure_idx
  ON public.surfboard_dimension_photo_memory_index (kind, failure_mode)
  WHERE active = true;

COMMENT ON TABLE public.surfboard_dimension_photo_memory_index IS
  'Retrieval index of admin-rated dimension-photo examples. Vision loads nearest + diverse Good/Bad/Close/Exclude rows into the prompt; phash is a 64-bit difference-hash of the example image.';

ALTER TABLE public.surfboard_dimension_photo_memory_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "surfboard_dimension_photo_memory_index_select_staff"
  ON public.surfboard_dimension_photo_memory_index;
CREATE POLICY "surfboard_dimension_photo_memory_index_select_staff"
  ON public.surfboard_dimension_photo_memory_index
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "surfboard_dimension_photo_memory_index_write_admin"
  ON public.surfboard_dimension_photo_memory_index;
CREATE POLICY "surfboard_dimension_photo_memory_index_write_admin"
  ON public.surfboard_dimension_photo_memory_index
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
