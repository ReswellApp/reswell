-- Listing-aligned condition per catalog variant. Uniqueness is now dims + fin_box_type + condition.

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'brand_new';

ALTER TABLE public.brand_model_variants
  DROP CONSTRAINT IF EXISTS brand_model_variants_condition_check;

ALTER TABLE public.brand_model_variants
  ADD CONSTRAINT brand_model_variants_condition_check CHECK (
    condition IN ('brand_new', 'excellent', 'very_good', 'good', 'fair', 'poor')
  );

DROP INDEX IF EXISTS public.brand_model_variants_model_dims_fin_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS brand_model_variants_model_dims_fin_condition_uidx
  ON public.brand_model_variants (
    brand_model_id,
    lower(trim(length_label)),
    lower(trim(width_label)),
    lower(trim(thickness_label)),
    lower(trim(volume_label)),
    fin_box_type,
    condition
  );

COMMENT ON COLUMN public.brand_model_variants.condition IS
  'Matches listings.condition (sellable set): brand_new … poor.';
