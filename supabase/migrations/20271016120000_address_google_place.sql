-- Google place id, coordinates, and formatted address on saved addresses.
-- Used by Surfboard Shipped pickup and checkout drop-off. Street lines stay on the existing columns.

BEGIN;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS formatted_address text;

COMMENT ON COLUMN public.addresses.google_place_id IS
  'Google Places id for this street. Null until a Google lookup resolves it.';
COMMENT ON COLUMN public.addresses.latitude IS
  'Latitude from the Google lookup. Null until resolved.';
COMMENT ON COLUMN public.addresses.longitude IS
  'Longitude from the Google lookup. Null until resolved.';
COMMENT ON COLUMN public.addresses.formatted_address IS
  'Formatted street address returned by Google. Structured line1/city/state/postal stay the shipping fields.';

COMMIT;
