-- Mark address coordinates that were resolved by the server rather than trusted from a client.

BEGIN;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS google_geocoded_at timestamptz;

COMMENT ON COLUMN public.addresses.google_geocoded_at IS
  'When the server last resolved google_place_id and coordinates. Null means location metadata is unverified.';

COMMIT;
