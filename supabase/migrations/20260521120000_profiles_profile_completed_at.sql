-- Track whether a user finished post-signup profile setup (display name + optional photo).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- Existing accounts already onboarded; only new sign-ups after this migration see the modal.
UPDATE public.profiles
SET profile_completed_at = COALESCE(updated_at, created_at, NOW())
WHERE profile_completed_at IS NULL;
