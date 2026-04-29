-- Extend fin layout constraint to include Twin (distinct from Twinzer).

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
      'twin',
      'twinzer'
    )
  );

COMMENT ON COLUMN public.brand_model_variants.fin_boxes IS
  'Fin layout/box routing: five-fin, thruster, quad, single-fin, 2+1, Twin, Twinzer.';
