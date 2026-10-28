-- Independent lock-screen toggles. push_opt_in stays the master: false means
-- every topic is off even if a column still defaults to true.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_offers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_saves boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_follows boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_orders boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.push_messages IS
  'Lock-screen alerts for marketplace chat.';
COMMENT ON COLUMN public.notification_preferences.push_offers IS
  'Lock-screen alerts for offers.';
COMMENT ON COLUMN public.notification_preferences.push_saves IS
  'Lock-screen alerts when someone saves your listing.';
COMMENT ON COLUMN public.notification_preferences.push_follows IS
  'Lock-screen alerts for followed sellers (new listings and price drops).';
COMMENT ON COLUMN public.notification_preferences.push_orders IS
  'Lock-screen alerts for deliveries, payouts, and listing status.';
