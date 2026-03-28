-- Remove a full sandbox test flow: pending cash-out + marketplace sale + fake wallet balance.
-- Order: undo cash-out first, then undo sale.
--
-- Run in Supabase SQL Editor (postgres or service role).
--
-- Manual ids: in INSERT INTO _manual below, replace SKIP_CASHOUT with a cashout_requests.id uuid,
-- or SKIP_PURCHASE with a purchases.id uuid, or both. Keep the literal text SKIP_* to leave that
-- side on auto-match.
--
-- ---------------------------------------------------------------------------
-- PREVIEW (run alone)
-- ---------------------------------------------------------------------------
-- SELECT id, status, amount, fee, payment_method, payment_email, created_at
-- FROM public.cashout_requests ORDER BY created_at DESC LIMIT 10;
-- SELECT id, amount, seller_earnings, stripe_checkout_session_id, created_at
-- FROM public.purchases WHERE status = 'confirmed' ORDER BY created_at DESC LIMIT 10;
-- SELECT id, type, amount, description, reference_id, created_at
-- FROM public.wallet_transactions ORDER BY created_at DESC LIMIT 20;

BEGIN;

-- Paste UUIDs from Table Editor between quotes, or leave SKIP_CASHOUT / SKIP_PURCHASE unchanged for auto-only.
CREATE TEMP TABLE _manual (cashout_id uuid, purchase_id uuid) ON COMMIT DROP;
INSERT INTO _manual
SELECT
  CASE trim('SKIP_CASHOUT')
    WHEN 'SKIP_CASHOUT' THEN NULL::uuid
    ELSE trim('SKIP_CASHOUT')::uuid
  END,
  CASE trim('SKIP_PURCHASE')
    WHEN 'SKIP_PURCHASE' THEN NULL::uuid
    ELSE trim('SKIP_PURCHASE')::uuid
  END;

CREATE TEMP TABLE _cancel_cashout (
  cashout_id uuid,
  wallet_id uuid,
  amount numeric,
  user_id uuid
) ON COMMIT DROP;

INSERT INTO _cancel_cashout (cashout_id, wallet_id, amount, user_id)
SELECT cr.id, cr.wallet_id, cr.amount::numeric, cr.user_id
FROM public.cashout_requests cr
JOIN _manual m ON m.cashout_id IS NOT NULL AND cr.id = m.cashout_id;

INSERT INTO _cancel_cashout (cashout_id, wallet_id, amount, user_id)
SELECT sub.cashout_id, sub.wallet_id, sub.amount, sub.user_id
FROM (
  SELECT cr.id AS cashout_id,
         cr.wallet_id,
         cr.amount::numeric AS amount,
         cr.user_id
  FROM public.cashout_requests cr
  CROSS JOIN _manual m
  WHERE m.cashout_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM _cancel_cashout)
    AND cr.status IN ('pending', 'processing')
    AND lower(trim(cr.payment_method)) LIKE '%venmo%'
    AND cr.amount::numeric BETWEEN 500 AND 5000
  ORDER BY cr.created_at DESC
  LIMIT 1
) sub;

INSERT INTO _cancel_cashout (cashout_id, wallet_id, amount, user_id)
SELECT cr.id, cr.wallet_id, cr.amount::numeric, cr.user_id
FROM public.cashout_requests cr
CROSS JOIN _manual m
WHERE m.cashout_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM _cancel_cashout)
  AND cr.status IN ('pending', 'processing')
  AND (SELECT count(*)::int FROM public.cashout_requests WHERE status IN ('pending', 'processing')) = 1
ORDER BY cr.created_at DESC
LIMIT 1;

-- Small DB fallback: most recent open-ish cash-out (not completed/paid) if few rows total.
INSERT INTO _cancel_cashout (cashout_id, wallet_id, amount, user_id)
SELECT cr.id, cr.wallet_id, cr.amount::numeric, cr.user_id
FROM public.cashout_requests cr
CROSS JOIN _manual m
WHERE m.cashout_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM _cancel_cashout)
  AND (SELECT count(*)::int FROM public.cashout_requests) <= 15
  AND lower(coalesce(cr.status, '')) IN ('pending', 'processing', 'failed', 'cancelled', 'rejected')
ORDER BY cr.created_at DESC
LIMIT 1;

CREATE TEMP TABLE _purge_purchase (
  purchase_id uuid,
  seller_id uuid,
  buyer_id uuid,
  listing_id uuid,
  seller_earnings numeric
) ON COMMIT DROP;

INSERT INTO _purge_purchase (purchase_id, seller_id, buyer_id, listing_id, seller_earnings)
SELECT p.id, p.seller_id, p.buyer_id, p.listing_id, p.seller_earnings::numeric
FROM public.purchases p
JOIN _manual m ON m.purchase_id IS NOT NULL AND p.id = m.purchase_id;

INSERT INTO _purge_purchase (purchase_id, seller_id, buyer_id, listing_id, seller_earnings)
SELECT x.purchase_id, x.seller_id, x.buyer_id, x.listing_id, x.seller_earnings
FROM (
  SELECT purchase_id, seller_id, buyer_id, listing_id, seller_earnings, pri
  FROM (
    SELECT p.id AS purchase_id,
           p.seller_id,
           p.buyer_id,
           p.listing_id,
           p.seller_earnings::numeric AS seller_earnings,
           1 AS pri
    FROM public.wallet_transactions wt
    JOIN public.purchases p
      ON p.id::text = wt.reference_id::text
     AND p.status = 'confirmed'
    WHERE wt.type = 'sale'
      AND (
        wt.description ILIKE '%Trip Plan Hull%'
        OR wt.description ILIKE '%Trip Plan%'
        OR wt.description ILIKE '%Channel Islands%'
      )
    ORDER BY wt.created_at DESC
    LIMIT 1
  ) a
  UNION ALL
  SELECT b.purchase_id,
         b.seller_id,
         b.buyer_id,
         b.listing_id,
         b.seller_earnings,
         b.pri
  FROM (
    SELECT p.id AS purchase_id,
           p.seller_id,
           p.buyer_id,
           p.listing_id,
           p.seller_earnings::numeric AS seller_earnings,
           2 AS pri
    FROM public.purchases p
    JOIN public.listings l ON l.id = p.listing_id
    WHERE p.status = 'confirmed'
      AND p.stripe_checkout_session_id IS NOT NULL
      AND trim(p.stripe_checkout_session_id) <> ''
      AND (
        l.title ILIKE '%Trip Plan Hull%'
        OR l.title ILIKE '%Trip Plan%'
        OR (l.title ILIKE '%channel%' AND l.title ILIKE '%island%')
      )
    ORDER BY p.created_at DESC
    LIMIT 1
  ) b
) x
CROSS JOIN _manual m
WHERE m.purchase_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM _purge_purchase)
ORDER BY x.pri
LIMIT 1;

INSERT INTO _purge_purchase (purchase_id, seller_id, buyer_id, listing_id, seller_earnings)
SELECT p.id, p.seller_id, p.buyer_id, p.listing_id, p.seller_earnings::numeric
FROM public.purchases p
CROSS JOIN _manual m
WHERE m.purchase_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM _purge_purchase)
  AND p.status = 'confirmed'
  AND p.stripe_checkout_session_id IS NOT NULL
  AND trim(p.stripe_checkout_session_id) <> ''
  AND (
    SELECT count(*)::int
    FROM public.purchases p2
    WHERE p2.status = 'confirmed'
      AND p2.stripe_checkout_session_id IS NOT NULL
      AND trim(p2.stripe_checkout_session_id) <> ''
  ) = 1
ORDER BY p.created_at DESC
LIMIT 1;

-- No stripe_session on row: still match text on sale transaction (any confirmed purchase linked).
INSERT INTO _purge_purchase (purchase_id, seller_id, buyer_id, listing_id, seller_earnings)
SELECT p.id, p.seller_id, p.buyer_id, p.listing_id, p.seller_earnings::numeric
FROM public.wallet_transactions wt
JOIN public.purchases p
  ON p.id::text = wt.reference_id::text
 AND p.status = 'confirmed'
CROSS JOIN _manual m
WHERE m.purchase_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM _purge_purchase)
  AND wt.type = 'sale'
ORDER BY wt.created_at DESC
LIMIT 1;

-- Small DB fallback: latest confirmed purchase if you have few completed sales total.
INSERT INTO _purge_purchase (purchase_id, seller_id, buyer_id, listing_id, seller_earnings)
SELECT p.id, p.seller_id, p.buyer_id, p.listing_id, p.seller_earnings::numeric
FROM public.purchases p
CROSS JOIN _manual m
WHERE m.purchase_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM _purge_purchase)
  AND p.status = 'confirmed'
  AND (SELECT count(*)::int FROM public.purchases WHERE status = 'confirmed') <= 15
ORDER BY p.created_at DESC
LIMIT 1;

DO $$
DECLARE
  nc int;
  np int;
BEGIN
  SELECT count(*)::int INTO nc FROM _cancel_cashout;
  SELECT count(*)::int INTO np FROM _purge_purchase;
  IF nc = 0 AND np = 0 THEN
    RAISE EXCEPTION
      'Nothing matched. In the INSERT INTO _manual block, replace SKIP_CASHOUT and/or SKIP_PURCHASE with uuid strings from PREVIEW (or widen table row limits in script if you have >15 rows).';
  END IF;
END $$;

UPDATE public.wallets w
SET
  balance = (w.balance::numeric + c.amount)::numeric(10, 2),
  lifetime_cashed_out = (w.lifetime_cashed_out::numeric - c.amount)::numeric(10, 2),
  updated_at = now()
FROM _cancel_cashout c
WHERE w.id = c.wallet_id;

DELETE FROM public.wallet_transactions wt
USING _cancel_cashout c
WHERE wt.reference_id::text = c.cashout_id::text
  AND wt.type = 'cashout';

DELETE FROM public.cashout_requests cr
USING _cancel_cashout c
WHERE cr.id = c.cashout_id;

UPDATE public.wallets w
SET
  balance = (w.balance::numeric - p.seller_earnings)::numeric(10, 2),
  lifetime_earned = (w.lifetime_earned::numeric - p.seller_earnings)::numeric(10, 2),
  updated_at = now()
FROM _purge_purchase p
WHERE w.user_id = p.seller_id;

DELETE FROM public.wallet_transactions wt
USING _purge_purchase p
WHERE wt.reference_id::text = p.purchase_id::text
  AND wt.type IN ('sale', 'purchase');

DELETE FROM public.purchases pur
USING _purge_purchase p
WHERE pur.id = p.purchase_id;

UPDATE public.listings l
SET status = 'active'
FROM _purge_purchase p
WHERE l.id = p.listing_id;

COMMIT;

-- Stripe (test mode): refund or ignore the test charge in the Dashboard if needed.
