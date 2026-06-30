-- Klaviyo inactive winback: measure inactivity from last auth sign-in, not presence heartbeats.
-- A user becomes "active" again only when Supabase records a new last_sign_in_at (login / OAuth).
-- Accounts that never signed in use created_at as the anchor.

-- From 20260614120000 — ensure column exists when that migration was not applied yet.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.profiles_eligible_for_klaviyo_inactivity (
  p_milestone_days integer,
  p_cutoff timestamptz
)
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  last_active_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    p.email,
    p.display_name,
    COALESCE(u.last_sign_in_at, u.created_at) AS last_active_at
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE COALESCE(u.last_sign_in_at, u.created_at) IS NOT NULL
    AND COALESCE(u.last_sign_in_at, u.created_at) < p_cutoff
    AND p.marketing_emails_opt_out = FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM public.klaviyo_inactivity_milestones k
      WHERE k.user_id = p.id
        AND k.milestone_days = p_milestone_days
        AND k.sent_at > COALESCE(u.last_sign_in_at, u.created_at)
    );
$$;

REVOKE ALL ON FUNCTION public.profiles_eligible_for_klaviyo_inactivity (integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_eligible_for_klaviyo_inactivity (integer, timestamptz) TO service_role;
