-- One conversation thread per buyer + seller (listing_id remains optional UI context).
-- Merges duplicate rows from the previous per-listing model, then enforces uniqueness.

WITH ranked AS (
  SELECT
    id,
    buyer_id,
    seller_id,
    ROW_NUMBER() OVER (
      PARTITION BY buyer_id, seller_id
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.conversations
),
dupes AS (
  SELECT id AS old_id, buyer_id, seller_id
  FROM ranked
  WHERE rn > 1
),
canonical AS (
  SELECT buyer_id, seller_id, id AS canonical_id
  FROM ranked
  WHERE rn = 1
)
UPDATE public.messages m
SET conversation_id = c.canonical_id
FROM dupes d
JOIN canonical c ON c.buyer_id = d.buyer_id AND c.seller_id = d.seller_id
WHERE m.conversation_id = d.old_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY buyer_id, seller_id
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.conversations
)
DELETE FROM public.conversations c
WHERE c.id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_buyer_seller_uidx
  ON public.conversations (buyer_id, seller_id);
