-- Fin template geometry on catalog variants: base, height, and foil profile.

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS fin_base_label text NOT NULL DEFAULT '';

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS fin_height_label text NOT NULL DEFAULT '';

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS fin_foil_label text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.brand_model_variants.fin_base_label IS
  'Fin template base measurement (free text), e.g. 5.05". Empty for surfboard variants.';

COMMENT ON COLUMN public.brand_model_variants.fin_height_label IS
  'Fin template height measurement (free text), e.g. 5.63". Empty for surfboard variants.';

COMMENT ON COLUMN public.brand_model_variants.fin_foil_label IS
  'Fin foil profile (free text), e.g. Flat, Inside, V2. Empty for surfboard variants.';

DROP INDEX IF EXISTS public.brand_model_variants_model_dims_fin_condition_boxes_material_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_variants_model_dims_fin_condition_boxes_material_uidx
  ON public.brand_model_variants (
    brand_model_id,
    lower(trim(length_label)),
    lower(trim(width_label)),
    lower(trim(thickness_label)),
    lower(trim(volume_label)),
    COALESCE(fin_size, ''),
    lower(trim(configuration_label)),
    lower(trim(fin_base_label)),
    lower(trim(fin_height_label)),
    lower(trim(fin_foil_label)),
    fin_box_type,
    condition,
    fin_boxes,
    material
  );
