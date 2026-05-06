-- Tracks which inactive-user Klaviyo milestone events were already emitted per user (idempotent cron).
-- Run in Supabase SQL editor or your migration pipeline.

CREATE TABLE IF NOT EXISTS public.klaviyo_inactivity_milestones (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  milestone_days SMALLINT NOT NULL CHECK (milestone_days IN (3, 15, 30)),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone_days)
);

CREATE INDEX IF NOT EXISTS idx_klaviyo_inactivity_milestones_days
  ON public.klaviyo_inactivity_milestones (milestone_days);

ALTER TABLE public.klaviyo_inactivity_milestones ENABLE ROW LEVEL SECURITY;

-- Eligible profiles for one milestone: last_active_at older than N days and no row for that milestone yet.
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
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.display_name, p.last_active_at
  FROM public.profiles p
  WHERE p.last_active_at IS NOT NULL
    AND p.last_active_at < p_cutoff
    AND NOT EXISTS (
      SELECT 1
      FROM public.klaviyo_inactivity_milestones k
      WHERE k.user_id = p.id
        AND k.milestone_days = p_milestone_days
    );
$$;

REVOKE ALL ON FUNCTION public.profiles_eligible_for_klaviyo_inactivity (integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_eligible_for_klaviyo_inactivity (integer, timestamptz) TO service_role;
