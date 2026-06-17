-- Private account fields on profiles (not shown on public seller profile).
-- Used for shipping labels, SMS alerts, and account contact — separate from saved shipping addresses.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.profiles.first_name IS
  'Private legal first name — account/shipping only, not public profile.';

COMMENT ON COLUMN public.profiles.last_name IS
  'Private legal last name — account/shipping only, not public profile.';

COMMENT ON COLUMN public.profiles.phone IS
  'Private mobile number — account notifications and shipping labels, not public profile.';
