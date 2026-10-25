-- The header badge reads profiles.unread_message_count, maintained one row at a
-- time by messages_sync_profile_unread_count. Support threads are hidden from
-- /messages, so they must not move that counter.
--
-- A boolean on the conversation keeps the message trigger to the single
-- conversation lookup it already does. Linking or unlinking a support thread
-- adjusts only that thread's unread rows. We do not recount every profile.

COMMENT ON COLUMN public.profiles.unread_message_count IS
  'Unread inbound messages that appear in marketplace /messages. Excludes Reswell Support and admin threads.';

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS in_marketplace_inbox boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.conversations.in_marketplace_inbox IS
  'False for Reswell Support / admin threads hidden from /messages. The unread badge follows this flag.';

-- Keep in sync with MESSAGES_DIRECT_SUPPORT_EMAIL. Used when a conversation is
-- created or linked, not on the message hot path.
CREATE OR REPLACE FUNCTION public.marketplace_direct_support_email()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'haydensbsb@gmail.com'::text;
$$;

COMMENT ON FUNCTION public.marketplace_direct_support_email() IS
  'Seller email for listing-less Reswell Support DMs. Must match MESSAGES_DIRECT_SUPPORT_EMAIL.';

-- Same threads retainMarketplaceInboxConversations drops from /messages.
CREATE OR REPLACE FUNCTION public.conversation_hidden_from_marketplace_inbox(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.contact_messages cm
          WHERE cm.support_conversation_id = c.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.order_support_requests r
          WHERE r.support_conversation_id = c.id
        )
        OR (
          c.listing_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.profiles seller
            WHERE seller.id = c.seller_id
              AND seller.email IS NOT NULL
              AND lower(btrim(seller.email)) = public.marketplace_direct_support_email()
          )
        )
      )
  );
$$;

-- Flip the flag and add or remove only this thread's unread from the two participants.
CREATE OR REPLACE FUNCTION public.shift_marketplace_unread_for_inbox_flag(
  p_conversation_id uuid,
  p_in_marketplace_inbox boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_conversation_id IS NULL THEN
    RETURN;
  END IF;

  WITH flipped AS (
    UPDATE public.conversations c
    SET in_marketplace_inbox = p_in_marketplace_inbox
    WHERE c.id = p_conversation_id
      AND c.in_marketplace_inbox IS DISTINCT FROM p_in_marketplace_inbox
    RETURNING c.id, c.buyer_id, c.seller_id
  ),
  counts AS (
    SELECT recipient_id, count(*)::integer AS n
    FROM (
      SELECT CASE
        WHEN f.buyer_id = m.sender_id THEN f.seller_id
        WHEN f.seller_id = m.sender_id THEN f.buyer_id
        ELSE NULL
      END AS recipient_id
      FROM public.messages m
      INNER JOIN flipped f ON f.id = m.conversation_id
      WHERE m.is_read IS NOT TRUE
    ) unread
    WHERE recipient_id IS NOT NULL
    GROUP BY recipient_id
  )
  UPDATE public.profiles p
  SET unread_message_count = GREATEST(
    p.unread_message_count + CASE WHEN p_in_marketplace_inbox THEN counts.n ELSE -counts.n END,
    0
  )
  FROM counts
  WHERE p.id = counts.recipient_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_marketplace_inbox_visibility(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_conversation_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.shift_marketplace_unread_for_inbox_flag(
    p_conversation_id,
    NOT public.conversation_hidden_from_marketplace_inbox(p_conversation_id)
  );
END;
$$;

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
    WHEN NOT c.in_marketplace_inbox THEN NULL
    WHEN c.buyer_id = p_sender_id THEN c.seller_id
    WHEN c.seller_id = p_sender_id THEN c.buyer_id
    ELSE NULL
  END
  FROM public.conversations c
  WHERE c.id = p_conversation_id;
$$;

-- New listing-less DMs sold by the support account are support threads.
CREATE OR REPLACE FUNCTION public.conversations_mark_support_dm_inbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_id IS NULL AND EXISTS (
    SELECT 1
    FROM public.profiles seller
    WHERE seller.id = NEW.seller_id
      AND seller.email IS NOT NULL
      AND lower(btrim(seller.email)) = public.marketplace_direct_support_email()
  ) THEN
    NEW.in_marketplace_inbox := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_marketplace_unread_on_support_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.support_conversation_id IS NOT NULL THEN
      PERFORM public.apply_marketplace_inbox_visibility(OLD.support_conversation_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.support_conversation_id IS NOT DISTINCT FROM NEW.support_conversation_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.support_conversation_id IS NOT NULL THEN
    PERFORM public.apply_marketplace_inbox_visibility(OLD.support_conversation_id);
  END IF;
  IF NEW.support_conversation_id IS NOT NULL THEN
    PERFORM public.apply_marketplace_inbox_visibility(NEW.support_conversation_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_marketplace_unread_on_conversation_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.listing_id IS NOT DISTINCT FROM NEW.listing_id
     AND OLD.seller_id IS NOT DISTINCT FROM NEW.seller_id THEN
    RETURN NEW;
  END IF;

  PERFORM public.apply_marketplace_inbox_visibility(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_mark_support_dm_inbox ON public.conversations;
CREATE TRIGGER conversations_mark_support_dm_inbox
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.conversations_mark_support_dm_inbox();

DROP TRIGGER IF EXISTS contact_messages_sync_marketplace_unread ON public.contact_messages;
CREATE TRIGGER contact_messages_sync_marketplace_unread
  AFTER INSERT OR UPDATE OF support_conversation_id OR DELETE
  ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_marketplace_unread_on_support_link();

DROP TRIGGER IF EXISTS order_support_requests_sync_marketplace_unread ON public.order_support_requests;
CREATE TRIGGER order_support_requests_sync_marketplace_unread
  AFTER INSERT OR UPDATE OF support_conversation_id OR DELETE
  ON public.order_support_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_marketplace_unread_on_support_link();

DROP TRIGGER IF EXISTS conversations_sync_marketplace_unread_visibility ON public.conversations;
CREATE TRIGGER conversations_sync_marketplace_unread_visibility
  AFTER UPDATE OF listing_id, seller_id
  ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_marketplace_unread_on_conversation_visibility();

-- Mark existing support threads from the link tables and the support seller,
-- then subtract only those threads' unread. Starts from the small link indexes,
-- not a recount of every profile. Re-running flips nothing, so it does not subtract twice.
WITH support_seller AS (
  SELECT p.id
  FROM public.profiles p
  WHERE p.email IS NOT NULL
    AND lower(btrim(p.email)) = public.marketplace_direct_support_email()
),
flipped AS (
  UPDATE public.conversations c
  SET in_marketplace_inbox = false
  WHERE c.in_marketplace_inbox
    AND (
      EXISTS (
        SELECT 1
        FROM public.contact_messages cm
        WHERE cm.support_conversation_id = c.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.order_support_requests r
        WHERE r.support_conversation_id = c.id
      )
      OR (
        c.listing_id IS NULL
        AND c.seller_id IN (SELECT id FROM support_seller)
      )
    )
  RETURNING c.id, c.buyer_id, c.seller_id
),
counts AS (
  SELECT recipient_id, count(*)::integer AS n
  FROM (
    SELECT CASE
      WHEN f.buyer_id = m.sender_id THEN f.seller_id
      WHEN f.seller_id = m.sender_id THEN f.buyer_id
      ELSE NULL
    END AS recipient_id
    FROM public.messages m
    INNER JOIN flipped f ON f.id = m.conversation_id
    WHERE m.is_read IS NOT TRUE
  ) unread
  WHERE recipient_id IS NOT NULL
  GROUP BY recipient_id
)
UPDATE public.profiles p
SET unread_message_count = GREATEST(p.unread_message_count - counts.n, 0)
FROM counts
WHERE p.id = counts.recipient_id;
