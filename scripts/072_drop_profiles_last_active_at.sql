-- Run once in the Supabase SQL Editor (or via supabase db push).
-- Removes the Live-stats presence column added by 028_profiles_last_active_at.sql.

DROP INDEX IF EXISTS public.idx_profiles_last_active_at;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS last_active_at;
