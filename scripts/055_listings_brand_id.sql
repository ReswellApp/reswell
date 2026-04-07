-- Link surfboard listings to brands directory by FK instead of denormalized index_* slugs/label.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

UPDATE public.listings l
SET brand_id = b.id
FROM public.brands b
WHERE l.index_brand_slug IS NOT NULL
  AND b.slug = l.index_brand_slug
  AND (l.brand_id IS DISTINCT FROM b.id);

CREATE INDEX IF NOT EXISTS idx_listings_brand_id ON public.listings(brand_id)
  WHERE brand_id IS NOT NULL;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS index_brand_slug,
  DROP COLUMN IF EXISTS index_model_slug,
  DROP COLUMN IF EXISTS index_model_label;

COMMENT ON COLUMN public.listings.brand_id IS 'Directory brand when seller linked listing to Brands (nullable).';
