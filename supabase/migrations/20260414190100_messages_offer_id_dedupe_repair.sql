-- Repair for partial failures of 20260414190000 (unique index blocked by duplicate keys).
-- Safe to run multiple times.

DELETE FROM public.messages m
USING public.messages m2
WHERE m.offer_id IS NOT NULL
  AND m.offer_id = m2.offer_id
  AND m.conversation_id = m2.conversation_id
  AND m.id > m2.id;

CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_offer_uidx
  ON public.messages (conversation_id, offer_id)
  WHERE offer_id IS NOT NULL;
