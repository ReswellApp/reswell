-- Opt-in for SMS alerts when the user receives a marketplace message.
-- Klaviyo "Message Sent" flows can filter on this flag + SMS consent.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS message_sms_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.notification_preferences.message_sms_opt_in IS
  'When true, user opted in to SMS alerts for incoming marketplace messages (Klaviyo).';
