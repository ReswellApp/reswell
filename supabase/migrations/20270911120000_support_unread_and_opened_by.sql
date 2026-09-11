-- Staff-opened seller outreach vs member-opened cases, plus a live unread
-- support ticker that mirrors profiles.unread_message_count.

ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS opened_by text NOT NULL DEFAULT 'requester',
  ADD COLUMN IF NOT EXISTS requester_last_read_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_cases_opened_by_check'
  ) THEN
    ALTER TABLE public.support_cases
      ADD CONSTRAINT support_cases_opened_by_check
      CHECK (opened_by IN ('requester', 'staff'));
  END IF;
END $$;

COMMENT ON COLUMN public.support_cases.opened_by IS
  'requester opened the case, or staff reached out first (seller outreach).';
COMMENT ON COLUMN public.support_cases.requester_last_read_at IS
  'When the member last opened this thread. Agent messages after this are unread.';

UPDATE public.support_cases
SET opened_by = 'staff'
WHERE opened_by = 'requester'
  AND (
    subject LIKE 'Reswell needs information about order%'
    OR EXISTS (
      SELECT 1
      FROM public.support_case_events e
      WHERE e.case_id = support_cases.id
        AND e.event_type IN ('seller_outreach_opened', 'seller_follow_up_sent')
    )
  );

-- Existing threads should not flood the new ticker; only messages after deploy count.
UPDATE public.support_cases
SET requester_last_read_at = updated_at
WHERE requester_last_read_at IS NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unread_support_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.unread_support_count IS
  'Denormalized count of unread Reswell Support messages for nav/dashboard badges.';

CREATE OR REPLACE FUNCTION public.bump_profile_unread_support_count(
  p_profile_id uuid,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_profile_id IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET unread_support_count = GREATEST(unread_support_count + p_delta, 0)
  WHERE id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_unread_support_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
  v_last_read timestamptz;
  v_counts boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT c.requester_user_id, c.requester_last_read_at
      INTO v_requester, v_last_read
    FROM public.support_cases c
    WHERE c.id = OLD.case_id;

    IF v_requester IS NOT NULL
       AND OLD.author_role = 'agent'
       AND OLD.is_internal = false
       AND (v_last_read IS NULL OR OLD.created_at > v_last_read)
    THEN
      PERFORM public.bump_profile_unread_support_count(v_requester, -1);
    END IF;
    RETURN OLD;
  END IF;

  SELECT c.requester_user_id, c.requester_last_read_at
    INTO v_requester, v_last_read
  FROM public.support_cases c
  WHERE c.id = NEW.case_id;

  v_counts :=
    NEW.author_role = 'agent'
    AND NEW.is_internal = false
    AND v_requester IS NOT NULL
    AND (v_last_read IS NULL OR NEW.created_at > v_last_read);

  IF TG_OP = 'INSERT' THEN
    IF v_counts THEN
      PERFORM public.bump_profile_unread_support_count(v_requester, 1);
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.author_role = 'agent' AND OLD.is_internal = false
     AND (v_last_read IS NULL OR OLD.created_at > v_last_read)
  THEN
    PERFORM public.bump_profile_unread_support_count(v_requester, -1);
  END IF;
  IF v_counts THEN
    PERFORM public.bump_profile_unread_support_count(v_requester, 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_case_messages_sync_unread ON public.support_case_messages;
CREATE TRIGGER support_case_messages_sync_unread
  AFTER INSERT OR UPDATE OF author_role, is_internal, case_id OR DELETE
  ON public.support_case_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_unread_support_count();

CREATE OR REPLACE FUNCTION public.mark_support_case_read(p_case_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_requester uuid;
  v_last_read timestamptz;
  v_unread integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  SELECT requester_user_id, requester_last_read_at
    INTO v_requester, v_last_read
  FROM public.support_cases
  WHERE id = p_case_id;

  IF v_requester IS NULL OR v_requester <> v_user THEN
    RETURN 0;
  END IF;

  SELECT count(*)::integer
    INTO v_unread
  FROM public.support_case_messages m
  WHERE m.case_id = p_case_id
    AND m.author_role = 'agent'
    AND m.is_internal = false
    AND (v_last_read IS NULL OR m.created_at > v_last_read);

  UPDATE public.support_cases
  SET requester_last_read_at = now()
  WHERE id = p_case_id
    AND requester_user_id = v_user;

  IF v_unread > 0 THEN
    PERFORM public.bump_profile_unread_support_count(v_user, -v_unread);
  END IF;

  RETURN (
    SELECT COALESCE(unread_support_count, 0)
    FROM public.profiles
    WHERE id = v_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_support_case_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_profile_unread_support_count(uuid, integer) TO service_role;
