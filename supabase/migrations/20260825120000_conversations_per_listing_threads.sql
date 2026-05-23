-- One marketplace thread per buyer + seller + listing.
-- Support / general threads (listing_id IS NULL) remain one per buyer + seller pair.

DROP INDEX IF EXISTS public.conversations_buyer_seller_uidx;

-- Split merged threads: move offer-linked messages onto listing-specific conversations.
DO $$
DECLARE
  conv RECORD;
  listing_rec RECORD;
  target_conv_id UUID;
  src RECORD;
BEGIN
  FOR conv IN
    SELECT id, buyer_id, seller_id, listing_id, last_message_at, created_at
    FROM public.conversations
  LOOP
    FOR listing_rec IN
      SELECT DISTINCT o.listing_id AS lid
      FROM public.messages m
      JOIN public.offers o ON o.id = m.offer_id
      WHERE m.conversation_id = conv.id
        AND o.listing_id IS NOT NULL
        AND o.listing_id IS DISTINCT FROM conv.listing_id
    LOOP
      SELECT id
      INTO target_conv_id
      FROM public.conversations
      WHERE buyer_id = conv.buyer_id
        AND seller_id = conv.seller_id
        AND listing_id = listing_rec.lid
      LIMIT 1;

      IF target_conv_id IS NULL THEN
        INSERT INTO public.conversations (buyer_id, seller_id, listing_id, last_message_at, created_at)
        VALUES (conv.buyer_id, conv.seller_id, listing_rec.lid, conv.last_message_at, conv.created_at)
        RETURNING id INTO target_conv_id;
      END IF;

      UPDATE public.messages m
      SET conversation_id = target_conv_id
      FROM public.offers o
      WHERE m.conversation_id = conv.id
        AND m.offer_id = o.id
        AND o.listing_id = listing_rec.lid;
    END LOOP;
  END LOOP;

  -- Backfill listing_id on general threads that only contain offer activity for one listing.
  UPDATE public.conversations c
  SET listing_id = sub.lid
  FROM (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      o.listing_id AS lid
    FROM public.messages m
    JOIN public.offers o ON o.id = m.offer_id
    JOIN public.conversations cx ON cx.id = m.conversation_id
    WHERE cx.listing_id IS NULL
      AND o.listing_id IS NOT NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ) sub
  WHERE c.id = sub.conversation_id
    AND c.listing_id IS NULL;
END $$;

-- Merge duplicate (buyer, seller, listing) rows after split.
WITH ranked AS (
  SELECT
    id,
    buyer_id,
    seller_id,
    listing_id,
    ROW_NUMBER() OVER (
      PARTITION BY buyer_id, seller_id, listing_id
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.conversations
  WHERE listing_id IS NOT NULL
),
dupes AS (
  SELECT id AS old_id, buyer_id, seller_id, listing_id
  FROM ranked
  WHERE rn > 1
),
canonical AS (
  SELECT buyer_id, seller_id, listing_id, id AS canonical_id
  FROM ranked
  WHERE rn = 1
)
UPDATE public.messages m
SET conversation_id = c.canonical_id
FROM dupes d
JOIN canonical c
  ON c.buyer_id = d.buyer_id
 AND c.seller_id = d.seller_id
 AND c.listing_id IS NOT DISTINCT FROM d.listing_id
WHERE m.conversation_id = d.old_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY buyer_id, seller_id, listing_id
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.conversations
  WHERE listing_id IS NOT NULL
)
DELETE FROM public.conversations c
WHERE c.id IN (SELECT id FROM ranked WHERE rn > 1);

-- Merge duplicate general (null listing) threads per buyer+seller.
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
  WHERE listing_id IS NULL
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
  WHERE listing_id IS NULL
)
DELETE FROM public.conversations c
WHERE c.id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_buyer_seller_listing_uidx
  ON public.conversations (buyer_id, seller_id, listing_id)
  WHERE listing_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_buyer_seller_general_uidx
  ON public.conversations (buyer_id, seller_id)
  WHERE listing_id IS NULL;
