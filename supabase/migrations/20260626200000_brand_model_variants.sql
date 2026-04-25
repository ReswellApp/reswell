-- Normalized catalog variants: dimensions + exclusive fin box (Futures / FCS / single fin) per model.
-- brand_id is denormalized for querying; kept in sync via trigger from brand_models.

CREATE TYPE public.fin_box_type AS ENUM ('futures', 'fcs', 'single_fin');

CREATE TABLE IF NOT EXISTS public.brand_model_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  brand_model_id uuid NOT NULL REFERENCES public.brand_models (id) ON DELETE CASCADE,
  length_label text NOT NULL,
  width_label text NOT NULL,
  thickness_label text NOT NULL,
  volume_label text NOT NULL,
  fin_box_type public.fin_box_type NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_model_variants_labels_nonempty CHECK (
    length(trim(length_label)) > 0
    AND length(trim(width_label)) > 0
    AND length(trim(thickness_label)) > 0
    AND length(trim(volume_label)) > 0
  )
);

CREATE INDEX IF NOT EXISTS brand_model_variants_brand_id_idx ON public.brand_model_variants (brand_id);
CREATE INDEX IF NOT EXISTS brand_model_variants_model_id_idx ON public.brand_model_variants (brand_model_id);

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_variants_model_dims_fin_uidx
  ON public.brand_model_variants (
    brand_model_id,
    lower(trim(length_label)),
    lower(trim(width_label)),
    lower(trim(thickness_label)),
    lower(trim(volume_label)),
    fin_box_type
  );

CREATE OR REPLACE FUNCTION public.brand_model_variants_sync_brand_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT bm.brand_id INTO STRICT NEW.brand_id
  FROM public.brand_models bm
  WHERE bm.id = NEW.brand_model_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_model_variants_sync_brand ON public.brand_model_variants;
CREATE TRIGGER trg_brand_model_variants_sync_brand
  BEFORE INSERT OR UPDATE ON public.brand_model_variants
  FOR EACH ROW
  EXECUTE PROCEDURE public.brand_model_variants_sync_brand_id();

ALTER TABLE public.brand_model_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_model_variants_select_public" ON public.brand_model_variants;
CREATE POLICY "brand_model_variants_select_public" ON public.brand_model_variants FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_model_variants_insert_admin" ON public.brand_model_variants;
CREATE POLICY "brand_model_variants_insert_admin" ON public.brand_model_variants FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "brand_model_variants_update_admin" ON public.brand_model_variants;
CREATE POLICY "brand_model_variants_update_admin" ON public.brand_model_variants FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "brand_model_variants_delete_admin" ON public.brand_model_variants;
CREATE POLICY "brand_model_variants_delete_admin" ON public.brand_model_variants FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

-- Backfill from legacy jsonb column, then drop it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brand_models'
      AND column_name = 'dimension_variations'
  ) THEN
    INSERT INTO public.brand_model_variants (
      brand_model_id,
      brand_id,
      length_label,
      width_label,
      thickness_label,
      volume_label,
      fin_box_type,
      image_url,
      sort_order
    )
    SELECT
      bm.id,
      bm.brand_id,
      trim(both ' ' FROM (v.val ->> 'length_label')),
      trim(both ' ' FROM (v.val ->> 'width_label')),
      trim(both ' ' FROM (v.val ->> 'thickness_label')),
      trim(both ' ' FROM (v.val ->> 'volume_label')),
      'futures'::public.fin_box_type,
      NULLIF(trim(both ' ' FROM (v.val ->> 'image_url')), ''),
      (v.ord - 1)::integer
    FROM public.brand_models bm
    CROSS JOIN LATERAL jsonb_array_elements(bm.dimension_variations) WITH ORDINALITY AS v(val, ord)
    WHERE bm.dimension_variations IS NOT NULL
      AND jsonb_typeof(bm.dimension_variations) = 'array'
      AND jsonb_array_length(bm.dimension_variations) > 0
      AND trim(both ' ' FROM COALESCE(v.val ->> 'length_label', '')) <> ''
      AND trim(both ' ' FROM COALESCE(v.val ->> 'width_label', '')) <> ''
      AND trim(both ' ' FROM COALESCE(v.val ->> 'thickness_label', '')) <> ''
      AND trim(both ' ' FROM COALESCE(v.val ->> 'volume_label', '')) <> '';

    ALTER TABLE public.brand_models DROP COLUMN dimension_variations;
  END IF;
END $$;
