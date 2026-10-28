-- Marketplace chat is conversations + messages.
-- Support chat is support_cases + support_case_messages.
-- They are separate stores. This migration does not add a support flag on
-- conversations and does not change how marketplace unread is computed.
--
-- Older tickets dual-wrote a copy into messages. Those leftover rows are still
-- unread on some profiles (including Hayden’s shop ticker). Mark them read so
-- they leave the marketplace badge. New tickets do not write to messages.

ALTER TABLE public.messages DISABLE TRIGGER messages_sync_profile_unread_count;

UPDATE public.messages m
SET is_read = true
WHERE m.is_read IS NOT TRUE
  AND (
    EXISTS (
      SELECT 1
      FROM public.contact_messages cm
      WHERE cm.support_conversation_id = m.conversation_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.order_support_requests osr
      WHERE osr.support_conversation_id = m.conversation_id
    )
  );

ALTER TABLE public.messages ENABLE TRIGGER messages_sync_profile_unread_count;

COMMENT ON COLUMN public.profiles.unread_message_count IS
  'Denormalized count of unread inbound marketplace messages for header/inbox badges.';

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
WHERE p.id = c.profile_id
  AND p.unread_message_count IS DISTINCT FROM COALESCE(c.unread_count, 0);

UPDATE public.profiles p
SET unread_message_count = 0
WHERE p.unread_message_count > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.is_read IS NOT TRUE
      AND public.message_unread_recipient_id(m.conversation_id, m.sender_id) = p.id
  );
