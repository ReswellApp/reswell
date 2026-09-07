-- Admin Live stats and the presence heartbeat that wrote this column are gone.
-- Klaviyo inactivity already uses auth.users.last_sign_in_at (see
-- 20261230120000_klaviyo_inactivity_last_sign_in.sql).

DROP INDEX IF EXISTS public.idx_profiles_last_active_at;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS last_active_at;
