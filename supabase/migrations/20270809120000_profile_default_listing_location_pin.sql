-- Full last-used listing locality for /sell (city/state + pin). Still locality-scoped — never street.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_listing_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS default_listing_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS default_listing_display TEXT;

COMMENT ON COLUMN public.profiles.default_listing_lat IS
  'Latitude for last listing area pin; pairs with default_listing_city for /sell reuse.';

COMMENT ON COLUMN public.profiles.default_listing_lng IS
  'Longitude for last listing area pin; pairs with default_listing_city for /sell reuse.';

COMMENT ON COLUMN public.profiles.default_listing_display IS
  'Display label for last listing area (e.g. "Encinitas, CA"); prefill / one-tap reuse on /sell.';
