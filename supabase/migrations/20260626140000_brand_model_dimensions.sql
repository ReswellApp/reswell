-- Size / volume variations for a catalog board model (L × W × T + volume), each with an optional image.

CREATE TABLE IF NOT EXISTS public.brand_model_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_model_id uuid NOT NULL REFERENCES public.brand_models (id) ON DELETE CASCADE,
  length_label text NOT NULL,
  width_label text NOT NULL,
  thickness_label text NOT NULL,
  volume_label text NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_model_dimensions_labels_nonempty CHECK (
    length(trim(length_label)) > 0
    AND length(trim(width_label)) > 0
    AND length(trim(thickness_label)) > 0
    AND length(trim(volume_label)) > 0
  )
);

CREATE INDEX IF NOT EXISTS brand_model_dimensions_model_id_idx
  ON public.brand_model_dimensions (brand_model_id);

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_dimensions_model_dims_uidx
  ON public.brand_model_dimensions (
    brand_model_id,
    lower(trim(length_label)),
    lower(trim(width_label)),
    lower(trim(thickness_label)),
    lower(trim(volume_label))
  );

ALTER TABLE public.brand_model_dimensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_model_dimensions_select_public" ON public.brand_model_dimensions;
CREATE POLICY "brand_model_dimensions_select_public" ON public.brand_model_dimensions FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_model_dimensions_insert_admin" ON public.brand_model_dimensions;
CREATE POLICY "brand_model_dimensions_insert_admin" ON public.brand_model_dimensions FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "brand_model_dimensions_update_admin" ON public.brand_model_dimensions;
CREATE POLICY "brand_model_dimensions_update_admin" ON public.brand_model_dimensions FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "brand_model_dimensions_delete_admin" ON public.brand_model_dimensions;
CREATE POLICY "brand_model_dimensions_delete_admin" ON public.brand_model_dimensions FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
