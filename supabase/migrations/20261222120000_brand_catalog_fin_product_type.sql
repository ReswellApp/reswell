-- Fin-tailored catalog: tag models by product type and store fin-specific variant facets.

ALTER TABLE public.brand_models
  ADD COLUMN IF NOT EXISTS product_category_slug text NOT NULL DEFAULT 'surfboards';

ALTER TABLE public.brand_models
  DROP CONSTRAINT IF EXISTS brand_models_product_category_slug_valid;

ALTER TABLE public.brand_models
  ADD CONSTRAINT brand_models_product_category_slug_valid CHECK (
    product_category_slug IN (
      'surfboards',
      'fins',
      'wetsuits',
      'boardbags',
      'surfpacks',
      'leashes',
      'apparel',
      'accessories'
    )
  );

CREATE INDEX IF NOT EXISTS brand_models_product_category_slug_idx
  ON public.brand_models (product_category_slug);

COMMENT ON COLUMN public.brand_models.product_category_slug IS
  'Product type for this catalog model (surfboards, fins, …). Aligns with brand_product_categories slugs.';

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS fin_size text;

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS configuration_label text NOT NULL DEFAULT '';

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_fin_size_check;

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_fin_size_check CHECK (
    fin_size IS NULL
    OR fin_size IN ('xs', 's', 'm', 'l', 'xl', 'other')
  );

COMMENT ON COLUMN public.brand_model_variants.fin_size IS
  'Fin size slug (xs–xl) for fin catalog variants; NULL for surfboard size rows.';

COMMENT ON COLUMN public.brand_model_variants.configuration_label IS
  'Optional fin role/label, e.g. center, side, set of 3. Empty for surfboard variants.';

-- Include fin_size in dedupe key so fin configurations stay distinct without board dims.
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
    fin_box_type,
    condition,
    fin_boxes,
    material
  );
