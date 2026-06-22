-- Fin color on catalog variants (e.g. Black, Smoke, Volcanic).

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS fin_color_label text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.brand_model_variants.fin_color_label IS
  'Fin color (free text), e.g. Black, Smoke, Volcanic. Empty for surfboard variants.';

-- Include color in fin variant dedupe key.
DROP INDEX IF EXISTS public.brand_model_variants_fin_config_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_variants_fin_config_uidx
  ON public.brand_model_variants (
    brand_model_id,
    COALESCE(fin_size, ''),
    lower(trim(configuration_label)),
    lower(trim(fin_base_label)),
    lower(trim(fin_height_label)),
    lower(trim(fin_foil_label)),
    lower(trim(fin_color_label)),
    fin_box_type,
    condition,
    fin_boxes
  )
  WHERE product_category_slug = 'fins';
