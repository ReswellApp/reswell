-- Persist surfboard catalog model link + seller model label on marketplace listings.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands (id) ON DELETE SET NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS brand_model_id UUID REFERENCES public.brand_models (id) ON DELETE SET NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS model TEXT;

CREATE INDEX IF NOT EXISTS idx_listings_brand_model_id ON public.listings (brand_model_id)
  WHERE brand_model_id IS NOT NULL;

COMMENT ON COLUMN public.listings.brand_id IS 'Directory brand when seller linked the listing to public.brands (nullable).';
COMMENT ON COLUMN public.listings.brand_model_id IS 'Directory brand_models row when seller picked a catalog model (nullable).';
COMMENT ON COLUMN public.listings.model IS 'Surfboard model name from sell form (catalog pick or free text).';
