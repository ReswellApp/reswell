-- Saved "local pickup near me" browse preference (profile → Notifications).
-- When enabled, /boards applies geo + local-pickup filters for the signed-in user.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS local_pickup_near_me_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS local_pickup_near_me_location TEXT,
  ADD COLUMN IF NOT EXISTS local_pickup_near_me_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS local_pickup_near_me_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS local_pickup_near_me_radius_mi TEXT;

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_local_pickup_radius_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_local_pickup_radius_check
  CHECK (
    local_pickup_near_me_radius_mi IS NULL
    OR local_pickup_near_me_radius_mi IN ('25', '50', '100', '200')
  );

COMMENT ON COLUMN public.notification_preferences.local_pickup_near_me_enabled IS
  'When true, signed-in browse applies saved geo + local-pickup-only surfboard filters.';
COMMENT ON COLUMN public.notification_preferences.local_pickup_near_me_location IS
  'Display label for the saved pickup anchor (city/ZIP from geocode).';
COMMENT ON COLUMN public.notification_preferences.local_pickup_near_me_lat IS
  'Saved pickup anchor latitude.';
COMMENT ON COLUMN public.notification_preferences.local_pickup_near_me_lng IS
  'Saved pickup anchor longitude.';
COMMENT ON COLUMN public.notification_preferences.local_pickup_near_me_radius_mi IS
  'Search radius in miles (25, 50, 100, or 200).';
