-- Header /messages badge reads profiles.unread_message_count.
-- Support and admin threads are hidden from /messages, so they must not
-- increment that counter. Member Help unread stays on unread_support_count.

COMMENT ON COLUMN public.profiles.unread_message_count IS
  'Unread inbound messages that appear in marketplace /messages. Excludes Reswell Support and admin threads.';

-- Keep in sync with MESSAGES_DIRECT_SUPPORT_EMAIL.
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

-- Same threads retainMarketplaceInboxConversations drops from /messages:
-- ticket-linked DMs, order-support DMs, and listing-less DMs sold by the support account.
CREATE OR REPLACE FUNCTION public.conversation_excluded_from_marketplace_messages(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.contact_messages cm
      WHERE cm.support_conversation_id = p_conversation_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.order_support_requests r
      WHERE r.support_conversation_id = p_conversation_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      INNER JOIN public.profiles seller ON seller.id = c.seller_id
      WHERE c.id = p_conversation_id
        AND c.listing_id IS NULL
        AND seller.email IS NOT NULL
        AND lower(btrim(seller.email)) = public.marketplace_direct_support_email()
    );
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
    WHEN public.conversation_excluded_from_marketplace_messages(c.id) THEN NULL
    WHEN c.buyer_id = p_sender_id THEN c.seller_id
    WHEN c.seller_id = p_sender_id THEN c.buyer_id
    ELSE NULL
  END
  FROM public.conversations c
  WHERE c.id = p_conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.recompute_profile_unread_message_count(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.messages m
  INNER JOIN public.conversations c ON c.id = m.conversation_id
  WHERE m.is_read IS NOT TRUE
    AND NOT public.conversation_excluded_from_marketplace_messages(c.id)
    AND (
      (c.buyer_id = p_profile_id AND m.sender_id = c.seller_id)
      OR (c.seller_id = p_profile_id AND m.sender_id = c.buyer_id)
    );

  UPDATE public.profiles
  SET unread_message_count = COALESCE(v_count, 0)
  WHERE id = p_profile_id
    AND unread_message_count IS DISTINCT FROM COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_marketplace_unread_for_conversation(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid;
  v_seller uuid;
BEGIN
  IF p_conversation_id IS NULL THEN
    RETURN;
  END IF;

  SELECT c.buyer_id, c.seller_id
    INTO v_buyer, v_seller
  FROM public.conversations c
  WHERE c.id = p_conversation_id;

  PERFORM public.recompute_profile_unread_message_count(v_buyer);
  IF v_seller IS DISTINCT FROM v_buyer THEN
    PERFORM public.recompute_profile_unread_message_count(v_seller);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_marketplace_unread_on_support_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old uuid;
  v_new uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := NEW.support_conversation_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := OLD.support_conversation_id;
  ELSE
    v_old := OLD.support_conversation_id;
    v_new := NEW.support_conversation_id;
    IF v_old IS NOT DISTINCT FROM v_new THEN
      RETURN NEW;
    END IF;
  END IF;

  IF v_old IS NOT NULL THEN
    PERFORM public.recompute_marketplace_unread_for_conversation(v_old);
  END IF;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    PERFORM public.recompute_marketplace_unread_for_conversation(v_new);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
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
     AND OLD.buyer_id IS NOT DISTINCT FROM NEW.buyer_id
     AND OLD.seller_id IS NOT DISTINCT FROM NEW.seller_id THEN
    RETURN NEW;
  END IF;

  PERFORM public.recompute_profile_unread_message_count(OLD.buyer_id);
  PERFORM public.recompute_profile_unread_message_count(OLD.seller_id);
  PERFORM public.recompute_profile_unread_message_count(NEW.buyer_id);
  PERFORM public.recompute_profile_unread_message_count(NEW.seller_id);
  RETURN NEW;
END;
$$;

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
  AFTER UPDATE OF listing_id, buyer_id, seller_id
  ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_marketplace_unread_on_conversation_visibility();

-- Rebuild stored counts so an existing support unread no longer lights the badge.
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
SET unread_message_count = c.unread_count
FROM counts c
WHERE p.id = c.profile_id
  AND p.unread_message_count IS DISTINCT FROM c.unread_count;

UPDATE public.profiles p
SET unread_message_count = 0
WHERE p.unread_message_count <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.is_read IS NOT TRUE
      AND public.message_unread_recipient_id(m.conversation_id, m.sender_id) = p.id
  );
