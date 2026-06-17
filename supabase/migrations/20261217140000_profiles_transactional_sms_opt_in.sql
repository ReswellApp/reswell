-- Tracks opt-in to transactional SMS (order/shipping/label updates) via personal info phone save.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS transactional_sms_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.transactional_sms_opt_in IS
  'User opted in to transactional SMS (orders, shipments, labels) by saving a phone on personal info.';
