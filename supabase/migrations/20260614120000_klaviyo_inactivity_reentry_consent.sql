-- Inactive-user Klaviyo winback upgrades:
--   1. Re-entry: a milestone should only block re-sending while the user stays inactive.
--      Once they become active again (last_active_at moves forward past the recorded send),
--      the same milestone becomes eligible again on the next inactivity streak.
--   2. Consent: respect a local marketing opt-out so we never generate winback events for
--      users who asked out (Klaviyo remains the final suppression gate at send time).

-- Local marketing suppression switch. Default false = unchanged behavior for existing users.
-- Wire an unsubscribe source (Klaviyo webhook / account settings) to flip this to true.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- Eligible profiles for one milestone:
--   * presence recorded (last_active_at not null) and older than N days
--   * not opted out of marketing email
--   * no milestone row recorded *during the current inactivity streak*
--     (a row with sent_at > last_active_at means we already messaged this streak).
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
    AND p.marketing_emails_opt_out = FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM public.klaviyo_inactivity_milestones k
      WHERE k.user_id = p.id
        AND k.milestone_days = p_milestone_days
        AND k.sent_at > p.last_active_at
    );
$$;

REVOKE ALL ON FUNCTION public.profiles_eligible_for_klaviyo_inactivity (integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_eligible_for_klaviyo_inactivity (integer, timestamptz) TO service_role;
