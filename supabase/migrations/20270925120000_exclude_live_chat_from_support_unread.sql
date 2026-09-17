-- Live chat is its own surface (the widget). Member /support lists and
-- Messages → Activity already hide source_channel = live_chat, but the
-- unread ticker still counted those agent turns — so chatting in the
-- widget lit up the header badge with items that could never be cleared.

COMMENT ON COLUMN public.profiles.unread_support_count IS
  'Denormalized unread Reswell Support messages for nav/dashboard badges. Excludes live_chat (widget-only).';

CREATE OR REPLACE FUNCTION public.sync_profile_unread_support_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
  v_last_read timestamptz;
  v_source text;
  v_old_requester uuid;
  v_old_last_read timestamptz;
  v_old_source text;
  v_counts boolean;
  v_old_counted boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT c.requester_user_id, c.requester_last_read_at, c.source_channel
      INTO v_requester, v_last_read, v_source
    FROM public.support_cases c
    WHERE c.id = OLD.case_id;

    IF v_source IS DISTINCT FROM 'live_chat'
       AND v_requester IS NOT NULL
       AND OLD.author_role = 'agent'
       AND OLD.is_internal = false
       AND (v_last_read IS NULL OR OLD.created_at > v_last_read)
    THEN
      PERFORM public.bump_profile_unread_support_count(v_requester, -1);
    END IF;
    RETURN OLD;
  END IF;

  SELECT c.requester_user_id, c.requester_last_read_at, c.source_channel
    INTO v_requester, v_last_read, v_source
  FROM public.support_cases c
  WHERE c.id = NEW.case_id;

  v_counts :=
    v_source IS DISTINCT FROM 'live_chat'
    AND NEW.author_role = 'agent'
    AND NEW.is_internal = false
    AND v_requester IS NOT NULL
    AND (v_last_read IS NULL OR NEW.created_at > v_last_read);

  IF TG_OP = 'INSERT' THEN
    IF v_counts THEN
      PERFORM public.bump_profile_unread_support_count(v_requester, 1);
    END IF;
    RETURN NEW;
  END IF;

  SELECT c.requester_user_id, c.requester_last_read_at, c.source_channel
    INTO v_old_requester, v_old_last_read, v_old_source
  FROM public.support_cases c
  WHERE c.id = OLD.case_id;

  v_old_counted :=
    v_old_source IS DISTINCT FROM 'live_chat'
    AND OLD.author_role = 'agent'
    AND OLD.is_internal = false
    AND v_old_requester IS NOT NULL
    AND (v_old_last_read IS NULL OR OLD.created_at > v_old_last_read);

  IF v_old_counted THEN
    PERFORM public.bump_profile_unread_support_count(v_old_requester, -1);
  END IF;
  IF v_counts THEN
    PERFORM public.bump_profile_unread_support_count(v_requester, 1);
  END IF;
  RETURN NEW;
END;
$$;

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
  v_source text;
  v_unread integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  SELECT requester_user_id, requester_last_read_at, source_channel
    INTO v_requester, v_last_read, v_source
  FROM public.support_cases
  WHERE id = p_case_id;

  IF v_requester IS NULL OR v_requester <> v_user THEN
    RETURN 0;
  END IF;

  UPDATE public.support_cases
  SET requester_last_read_at = now()
  WHERE id = p_case_id
    AND requester_user_id = v_user;

  -- Live chat never contributes to the ticker; do not decrement it here.
  IF v_source IS DISTINCT FROM 'live_chat' THEN
    SELECT count(*)::integer
      INTO v_unread
    FROM public.support_case_messages m
    WHERE m.case_id = p_case_id
      AND m.author_role = 'agent'
      AND m.is_internal = false
      AND (v_last_read IS NULL OR m.created_at > v_last_read);

    IF v_unread > 0 THEN
      PERFORM public.bump_profile_unread_support_count(v_user, -v_unread);
    END IF;
  END IF;

  RETURN (
    SELECT COALESCE(unread_support_count, 0)
    FROM public.profiles
    WHERE id = v_user
  );
END;
$$;

-- Rebuild so leftover live-chat ticks disappear from existing profiles.
WITH counts AS (
  SELECT c.requester_user_id AS profile_id, count(*)::integer AS unread_count
  FROM public.support_case_messages m
  JOIN public.support_cases c ON c.id = m.case_id
  WHERE m.author_role = 'agent'
    AND m.is_internal = false
    AND c.requester_user_id IS NOT NULL
    AND c.source_channel IS DISTINCT FROM 'live_chat'
    AND (c.requester_last_read_at IS NULL OR m.created_at > c.requester_last_read_at)
  GROUP BY c.requester_user_id
)
UPDATE public.profiles p
SET unread_support_count = COALESCE(c.unread_count, 0)
FROM counts c
WHERE p.id = c.profile_id
  AND p.unread_support_count IS DISTINCT FROM COALESCE(c.unread_count, 0);

UPDATE public.profiles p
SET unread_support_count = 0
WHERE p.unread_support_count > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.support_case_messages m
    JOIN public.support_cases c ON c.id = m.case_id
    WHERE c.requester_user_id = p.id
      AND m.author_role = 'agent'
      AND m.is_internal = false
      AND c.source_channel IS DISTINCT FROM 'live_chat'
      AND (c.requester_last_read_at IS NULL OR m.created_at > c.requester_last_read_at)
  );
