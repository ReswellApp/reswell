-- Private browse anchor on profiles (Profile → Shop). Locality only — city/ZIP + pin, not street.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS browse_home_location TEXT,
  ADD COLUMN IF NOT EXISTS browse_home_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS browse_home_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS browse_home_radius_mi TEXT,
  ADD COLUMN IF NOT EXISTS browse_home_apply_on_boards BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS browse_home_local_pickup_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_browse_home_radius_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_browse_home_radius_check
  CHECK (
    browse_home_radius_mi IS NULL
    OR browse_home_radius_mi IN ('25', '50', '100', '200')
  );

COMMENT ON COLUMN public.profiles.browse_home_location IS
  'Display label for the member''s home surf area (e.g. city/ZIP); used for browse geo prefill.';
COMMENT ON COLUMN public.profiles.browse_home_lat IS
  'Latitude for browse_home_location.';
COMMENT ON COLUMN public.profiles.browse_home_lng IS
  'Longitude for browse_home_location.';
COMMENT ON COLUMN public.profiles.browse_home_radius_mi IS
  'Default surfboard browse radius in miles when apply_on_boards is true.';
COMMENT ON COLUMN public.profiles.browse_home_apply_on_boards IS
  'When true, signed-in /boards applies saved home geo as default location filters.';
COMMENT ON COLUMN public.profiles.browse_home_local_pickup_only IS
  'When true with apply_on_boards, also filters to listings that offer local pickup.';
