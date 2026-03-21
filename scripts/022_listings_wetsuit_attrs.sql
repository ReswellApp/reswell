-- Wetsuit facets for used Wetsuits — /used/wetsuits filters & sell form
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS wetsuit_size TEXT,
  ADD COLUMN IF NOT EXISTS wetsuit_thickness TEXT,
  ADD COLUMN IF NOT EXISTS wetsuit_zip_type TEXT;

COMMENT ON COLUMN public.listings.wetsuit_size IS
  'For wetsuits: XS | S | M | MS | MT | L | LS | LT | XL | XLS | XLT | XXL';
COMMENT ON COLUMN public.listings.wetsuit_thickness IS
  'For wetsuits: 2/2 | 3/2 | 4/3 | 5/4 | 6/4/3 | 6/5';
COMMENT ON COLUMN public.listings.wetsuit_zip_type IS
  'For wetsuits: hooded | chestzip | backzip';
