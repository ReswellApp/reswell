-- Whether the listed surfboard ships with fins. Null = seller did not specify.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS fins_included boolean;

COMMENT ON COLUMN public.listings.fins_included IS
  'True when fins are included with the board; false when they are not; null when unspecified.';
