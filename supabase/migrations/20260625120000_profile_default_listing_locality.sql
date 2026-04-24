-- Locality-only defaults for /sell location prefill (city + region; never street-level data).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_listing_city TEXT,
  ADD COLUMN IF NOT EXISTS default_listing_state TEXT;

COMMENT ON COLUMN public.profiles.default_listing_city IS
  'Last city used when publishing a surfboard listing; prefill on /sell (locality only).';

COMMENT ON COLUMN public.profiles.default_listing_state IS
  'State/region paired with default_listing_city for listing prefill (not a street address).';
