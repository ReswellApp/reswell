-- Leash facets for used Leashes — /used/leashes filters & sell form
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS leash_length TEXT,
  ADD COLUMN IF NOT EXISTS leash_thickness TEXT;

COMMENT ON COLUMN public.listings.leash_length IS
  'For leashes: length in feet as stored value (5–12), e.g. 6 = 6'' leash';
COMMENT ON COLUMN public.listings.leash_thickness IS
  'For leashes: cord thickness e.g. 5mm | 6mm | 7mm | 8mm | 9mm | 10mm';
