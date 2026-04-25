-- Store size/volume variations (L × W × T · vol + optional image per row) on each brand_models row.
-- If legacy public.brand_model_dimensions exists, backfill into JSON then drop the child table.

ALTER TABLE public.brand_models
  ADD COLUMN IF NOT EXISTS dimension_variations jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.brand_models.dimension_variations IS
  'Array of { id, length_label, width_label, thickness_label, volume_label, image_url }. Canonical store for admin CMS.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'brand_model_dimensions'
  ) THEN
    UPDATE public.brand_models bm
    SET dimension_variations = COALESCE(agg.variations, '[]'::jsonb)
    FROM (
      SELECT
        brand_model_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id::text,
            'length_label', length_label,
            'width_label', width_label,
            'thickness_label', thickness_label,
            'volume_label', volume_label,
            'image_url', image_url
          )
          ORDER BY sort_order, length_label
        ) AS variations
      FROM public.brand_model_dimensions
      GROUP BY brand_model_id
    ) agg
    WHERE bm.id = agg.brand_model_id;

    DROP TABLE public.brand_model_dimensions;
  END IF;
END $$;
