-- Fin catalog variants live in `brand_model_variants` (same table as surfboard sizes).
-- Rows are scoped with `product_category_slug = 'fins'`, aligned with
-- `brand_product_categories.category_slug` on the parent brand.
--
-- Fin-specific columns on this table:
--   fin_size, configuration_label, fin_base_label, fin_height_label, fin_foil_label
-- Surfboard rows keep product_category_slug = 'surfboards' and use length/width/thickness/volume labels.

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS product_category_slug text NOT NULL DEFAULT 'surfboards';

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_product_category_slug_valid;

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_product_category_slug_valid CHECK (
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

CREATE INDEX IF NOT EXISTS brand_model_variants_product_category_slug_idx
  ON public.brand_model_variants (product_category_slug);

CREATE INDEX IF NOT EXISTS brand_model_variants_fins_brand_idx
  ON public.brand_model_variants (brand_id)
  WHERE product_category_slug = 'fins';

COMMENT ON COLUMN public.brand_model_variants.product_category_slug IS
  'Product type for this variant row. Fin catalog variants use ''fins'', matching brand_product_categories slugs on the brand.';

COMMENT ON TABLE public.brand_model_variants IS
  'Catalog size/configuration rows per brand model. Surfboard variants use dimension labels; fin variants (product_category_slug = fins) use fin_size, configuration_label, fin_base_label, fin_height_label, and fin_foil_label.';

-- Backfill from parent model when present.
UPDATE public.brand_model_variants v
SET product_category_slug = bm.product_category_slug
FROM public.brand_models bm
WHERE bm.id = v.brand_model_id
  AND bm.product_category_slug IS NOT NULL;

-- Promote fin-shaped rows on fin-tagged brands.
UPDATE public.brand_model_variants v
SET product_category_slug = 'fins'
FROM public.brand_models bm
INNER JOIN public.brand_product_categories bpc
  ON bpc.brand_id = bm.brand_id
  AND bpc.category_slug = 'fins'
WHERE v.brand_model_id = bm.id
  AND (
    v.fin_size IS NOT NULL
    OR length(trim(v.configuration_label)) > 0
    OR length(trim(v.fin_base_label)) > 0
    OR length(trim(v.fin_height_label)) > 0
    OR length(trim(v.fin_foil_label)) > 0
  );

CREATE OR REPLACE FUNCTION public.brand_model_variants_sync_product_category_from_model()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  model_category text;
BEGIN
  SELECT bm.product_category_slug
  INTO model_category
  FROM public.brand_models bm
  WHERE bm.id = NEW.brand_model_id;

  IF model_category IS NOT NULL AND trim(model_category) <> '' THEN
    NEW.product_category_slug := model_category;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_model_variants_sync_product_category ON public.brand_model_variants;
CREATE TRIGGER trg_brand_model_variants_sync_product_category
  BEFORE INSERT OR UPDATE OF brand_model_id ON public.brand_model_variants
  FOR EACH ROW
  EXECUTE PROCEDURE public.brand_model_variants_sync_product_category_from_model();

-- Fin variants dedupe separately from surfboard dimension rows.
DROP INDEX IF EXISTS public.brand_model_variants_model_dims_fin_condition_boxes_material_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_variants_surfboard_dims_uidx
  ON public.brand_model_variants (
    brand_model_id,
    lower(trim(length_label)),
    lower(trim(width_label)),
    lower(trim(thickness_label)),
    lower(trim(volume_label)),
    fin_box_type,
    condition,
    fin_boxes,
    material
  )
  WHERE product_category_slug = 'surfboards';

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_variants_fin_config_uidx
  ON public.brand_model_variants (
    brand_model_id,
    COALESCE(fin_size, ''),
    lower(trim(configuration_label)),
    lower(trim(fin_base_label)),
    lower(trim(fin_height_label)),
    lower(trim(fin_foil_label)),
    fin_box_type,
    condition,
    fin_boxes
  )
  WHERE product_category_slug = 'fins';
