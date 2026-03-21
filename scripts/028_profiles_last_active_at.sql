-- Track recent activity for “live on platform” admin stats (updated by /api/presence).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON public.profiles (last_active_at DESC)
  WHERE last_active_at IS NOT NULL;
