-- Allow model-catalog requests before the seller matches a directory brand (`brand_id`).
-- When unknown, store the typed brand label in `seller_brand_name` until the brand exists in `public.brands`.

ALTER TABLE public.brand_model_requests
  ADD COLUMN IF NOT EXISTS seller_brand_name text;

ALTER TABLE public.brand_model_requests
  ALTER COLUMN brand_id DROP NOT NULL;

ALTER TABLE public.brand_model_requests
  ADD CONSTRAINT brand_model_requests_brand_binding_check CHECK (
    (brand_id IS NOT NULL AND seller_brand_name IS NULL)
    OR (
      brand_id IS NULL
      AND seller_brand_name IS NOT NULL
      AND length(trim(seller_brand_name)) > 0
    )
  );

COMMENT ON COLUMN public.brand_model_requests.seller_brand_name IS 'Brand name from the sell form when no `public.brands` row is linked (`brand_id` NULL).';

COMMENT ON TABLE public.brand_model_requests IS 'Sell-flow submissions for a surfboard model: linked to directory brand and/or typed brand name pending catalog entry.';
