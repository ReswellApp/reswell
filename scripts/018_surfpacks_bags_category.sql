-- Display name: Surfpacks & Bags (slug stays backpacks for URLs and FKs)
UPDATE public.categories
SET name = 'Surfpacks & Bags',
    description = 'Surfpacks and gear bags'
WHERE slug = 'backpacks' AND section = 'used';

-- Surfpack vs bag — used with /used/backpacks filters
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS pack_kind TEXT;

COMMENT ON COLUMN public.listings.pack_kind IS 'For surfpack/bag category: surfpack | bag';
