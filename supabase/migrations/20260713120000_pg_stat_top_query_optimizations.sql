-- pg_stat_statements top offenders (Jul 2026):
-- 1) get_unread_message_count RPC (~84% total app query time, ~134ms mean via PostgREST)
-- 2) wallets by user_id (~11ms mean — already indexed; keep explicit column lists in app)
-- 3) profiles by id (~7ms mean — PK scan; add unread_message_count here to drop RPC round-trip)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unread_message_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.unread_message_count IS
  'Denormalized count of unread inbound marketplace messages for header/inbox badges.';

CREATE INDEX IF NOT EXISTS conversations_buyer_id_idx
  ON public.conversations (buyer_id);

CREATE INDEX IF NOT EXISTS conversations_seller_id_idx
  ON public.conversations (seller_id);

CREATE INDEX IF NOT EXISTS messages_unread_by_conversation_idx
  ON public.messages (conversation_id)
  WHERE is_read IS NOT TRUE;

CREATE OR REPLACE FUNCTION public.message_unread_recipient_id(
  p_conversation_id uuid,
  p_sender_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.buyer_id = p_sender_id THEN c.seller_id
    WHEN c.seller_id = p_sender_id THEN c.buyer_id
    ELSE NULL
  END
  FROM public.conversations c
  WHERE c.id = p_conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.bump_profile_unread_message_count(
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
  SET unread_message_count = GREATEST(unread_message_count + p_delta, 0)
  WHERE id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_unread_message_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_recipient := public.message_unread_recipient_id(OLD.conversation_id, OLD.sender_id);
    IF v_recipient IS NOT NULL AND OLD.is_read IS NOT TRUE THEN
      PERFORM public.bump_profile_unread_message_count(v_recipient, -1);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_recipient := public.message_unread_recipient_id(NEW.conversation_id, NEW.sender_id);
    IF v_recipient IS NOT NULL AND NEW.is_read IS NOT TRUE THEN
      PERFORM public.bump_profile_unread_message_count(v_recipient, 1);
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
     OR OLD.sender_id IS DISTINCT FROM NEW.sender_id THEN
    v_recipient := public.message_unread_recipient_id(OLD.conversation_id, OLD.sender_id);
    IF v_recipient IS NOT NULL AND OLD.is_read IS NOT TRUE THEN
      PERFORM public.bump_profile_unread_message_count(v_recipient, -1);
    END IF;

    v_recipient := public.message_unread_recipient_id(NEW.conversation_id, NEW.sender_id);
    IF v_recipient IS NOT NULL AND NEW.is_read IS NOT TRUE THEN
      PERFORM public.bump_profile_unread_message_count(v_recipient, 1);
    END IF;
    RETURN NEW;
  END IF;

  v_recipient := public.message_unread_recipient_id(NEW.conversation_id, NEW.sender_id);
  IF v_recipient IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.is_read IS NOT TRUE AND NEW.is_read IS TRUE THEN
    PERFORM public.bump_profile_unread_message_count(v_recipient, -1);
  ELSIF OLD.is_read IS TRUE AND NEW.is_read IS NOT TRUE THEN
    PERFORM public.bump_profile_unread_message_count(v_recipient, 1);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_sync_profile_unread_count ON public.messages;
CREATE TRIGGER messages_sync_profile_unread_count
  AFTER INSERT OR UPDATE OF is_read, conversation_id, sender_id OR DELETE
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_unread_message_count();

-- Backfill denormalized counts from current message rows.
WITH unread AS (
  SELECT public.message_unread_recipient_id(m.conversation_id, m.sender_id) AS recipient_id
  FROM public.messages m
  WHERE m.is_read IS NOT TRUE
),
counts AS (
  SELECT recipient_id AS profile_id, count(*)::integer AS unread_count
  FROM unread
  WHERE recipient_id IS NOT NULL
  GROUP BY recipient_id
)
UPDATE public.profiles p
SET unread_message_count = COALESCE(c.unread_count, 0)
FROM counts c
WHERE p.id = c.profile_id;

UPDATE public.profiles p
SET unread_message_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.messages m
  WHERE m.is_read IS NOT TRUE
    AND public.message_unread_recipient_id(m.conversation_id, m.sender_id) = p.id
);

CREATE OR REPLACE FUNCTION public.get_unread_message_count(uid uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.unread_message_count
      FROM public.profiles p
      WHERE p.id = uid
    ),
    0
  )::bigint;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_message_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count(uuid) TO service_role;
