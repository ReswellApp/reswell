-- Optional MSRP (USD) per catalog variant, aligned with listings.price scale.

ALTER TABLE public.brand_model_variants
  ADD COLUMN IF NOT EXISTS price numeric(10, 2);

COMMENT ON COLUMN public.brand_model_variants.price IS
  'Optional MSRP in USD for this size / fin / condition row. NULL when unknown.';
