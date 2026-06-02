-- Align catalog variant fin/material vocabulary with the marketplace listing facets so the
-- admin Convert + variant editors use the exact same option sets as the pro browse filters:
--   fin_box_type -> Fin System   (futures | fcs_ii | fcs_twin_tab | single |
--                                  two_plus_one_futures | two_plus_one_fcs | glass_on | other)
--   fin_boxes    -> Fin Setup    (single | twin_only | twin | thruster | quad | five | other)
--   material     -> Board Construction (eps_epoxy | pu_poly | carbon | other)
--
-- Mappings below mirror the listings.fin_system / construction backfill in
-- 20261105120000_listings_pro_filter_facets.sql so both tables share one vocabulary.
--
-- IMPORTANT: each column's old constraint/type guard is removed BEFORE its remap UPDATE,
-- otherwise the UPDATE would be rejected by the still-active old CHECK constraint.

-- ---------------------------------------------------------------------------
-- 1) fin_box_type: enum -> text, remap to Fin System slugs, re-constrain.
--    (Converting the enum to text first means no value guard is active during remap.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.brand_model_variants
  ALTER COLUMN fin_box_type DROP DEFAULT;

ALTER TABLE public.brand_model_variants
  ALTER COLUMN fin_box_type TYPE text USING fin_box_type::text;

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_fin_box_type_check;

UPDATE public.brand_model_variants
SET fin_box_type = CASE fin_box_type
  WHEN 'fcs' THEN 'fcs_ii'
  WHEN 'single_fin' THEN 'single'
  ELSE fin_box_type -- 'futures' + any already-migrated value pass through unchanged
END;

ALTER TABLE public.brand_model_variants
  ALTER COLUMN fin_box_type SET DEFAULT 'futures';

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_fin_box_type_check CHECK (
    fin_box_type IN (
      'futures',
      'fcs_ii',
      'fcs_twin_tab',
      'single',
      'two_plus_one_futures',
      'two_plus_one_fcs',
      'glass_on',
      'other'
    )
  );

COMMENT ON COLUMN public.brand_model_variants.fin_box_type IS
  'Fin system / plug routing — mirrors listings.fin_system vocabulary.';

-- Enum type is no longer referenced once the column is text.
DROP TYPE IF EXISTS public.fin_box_type;

-- ---------------------------------------------------------------------------
-- 2) fin_boxes: drop old guard, remap layout slugs to Fin Setup vocab, re-constrain.
--    old single_fin -> single, two_plus_one -> twin ("Twin (2+1)"),
--    old twin -> twin_only ("Twin"), five_fin -> five, twinzer -> other.
-- ---------------------------------------------------------------------------
ALTER TABLE public.brand_model_variants
  ALTER COLUMN fin_boxes DROP DEFAULT;

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_fin_boxes_check;

UPDATE public.brand_model_variants
SET fin_boxes = CASE fin_boxes
  WHEN 'five_fin' THEN 'five'
  WHEN 'single_fin' THEN 'single'
  WHEN 'two_plus_one' THEN 'twin'
  WHEN 'twin' THEN 'twin_only'
  WHEN 'twinzer' THEN 'other'
  ELSE fin_boxes -- thruster, quad unchanged
END;

ALTER TABLE public.brand_model_variants
  ALTER COLUMN fin_boxes SET DEFAULT 'thruster';

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_fin_boxes_check CHECK (
    fin_boxes IN (
      'single',
      'twin_only',
      'twin',
      'thruster',
      'quad',
      'five',
      'other'
    )
  );

COMMENT ON COLUMN public.brand_model_variants.fin_boxes IS
  'Fin setup / layout — mirrors listings.fins_setup vocabulary.';

-- ---------------------------------------------------------------------------
-- 3) material: drop old guard, remap to Board Construction vocab, re-constrain.
-- ---------------------------------------------------------------------------
ALTER TABLE public.brand_model_variants
  ALTER COLUMN material DROP DEFAULT;

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_material_check;

UPDATE public.brand_model_variants
SET material = CASE material
  WHEN 'pu' THEN 'pu_poly'
  WHEN 'eps' THEN 'eps_epoxy'
  ELSE material -- any already-migrated value passes through unchanged
END;

ALTER TABLE public.brand_model_variants
  ALTER COLUMN material SET DEFAULT 'pu_poly';

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_material_check CHECK (
    material IN ('eps_epoxy', 'pu_poly', 'carbon', 'other')
  );

COMMENT ON COLUMN public.brand_model_variants.material IS
  'Board construction — mirrors listings.construction vocabulary.';
