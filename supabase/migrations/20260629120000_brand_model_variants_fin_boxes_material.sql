-- Fin layout ("fin boxes") and blank construction material per catalog variant.
-- fin_box_type (enum) stays: Futures / FCS / single-fin plug routing.

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS fin_boxes text NOT NULL DEFAULT 'thruster';

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_fin_boxes_check;

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_fin_boxes_check CHECK (
    fin_boxes IN (
      'five_fin',
      'thruster',
      'quad',
      'single_fin',
      'two_plus_one',
      'twinzer'
    )
  );

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS material text NOT NULL DEFAULT 'pu';

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_material_check;

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_material_check CHECK (material IN ('pu', 'eps'));

COMMENT ON COLUMN public.brand_model_variants.fin_boxes IS
  'Fin layout/box routing: five-fin, thruster, quad, single-fin, 2+1, Twinzer.';

COMMENT ON COLUMN public.brand_model_variants.material IS
  'Foam/blank construction: PU or EPS.';

DROP INDEX IF EXISTS public.brand_model_variants_model_dims_fin_condition_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_variants_model_dims_fin_condition_boxes_material_uidx
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
  );
