-- Link chat rows to offers for stable deduplication (one mirrored row per offer in a thread).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL;

-- MUST run before unique index: keep the oldest row per (conversation_id, offer_id).
DELETE FROM public.messages m
USING public.messages m2
WHERE m.offer_id IS NOT NULL
  AND m.offer_id = m2.offer_id
  AND m.conversation_id = m2.conversation_id
  AND m.id > m2.id;

-- Legacy duplicate "Offer:" lines (no offer_id yet): same thread, sender, and leading text.
DELETE FROM public.messages a
USING public.messages b
WHERE a.id > b.id
  AND a.conversation_id = b.conversation_id
  AND a.sender_id = b.sender_id
  AND a.offer_id IS NULL
  AND b.offer_id IS NULL
  AND a.content LIKE 'Offer:%'
  AND b.content LIKE 'Offer:%'
  AND substring(a.content from 1 for 36) = substring(b.content from 1 for 36);

CREATE INDEX IF NOT EXISTS idx_messages_offer_id ON public.messages (offer_id)
  WHERE offer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_offer_uidx
  ON public.messages (conversation_id, offer_id)
  WHERE offer_id IS NOT NULL;
