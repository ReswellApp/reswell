-- Leash facets for used Leashes — /used/leashes filters & sell form
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS leash_length TEXT,
  ADD COLUMN IF NOT EXISTS leash_thickness TEXT;

COMMENT ON COLUMN public.listings.leash_length IS
  'For leashes: length in feet as stored value 6 | 8 | 9 | 10 (digit string, e.g. 6 = 6 ft leash)';
COMMENT ON COLUMN public.listings.leash_thickness IS
  'For leashes: cord diameter in inches as stored value 3/16 | 1/4 | 5/16';
