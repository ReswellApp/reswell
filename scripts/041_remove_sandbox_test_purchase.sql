-- Remove a mistaken Stripe test (sandbox) marketplace sale from the database.
-- Reverses seller wallet credit, deletes wallet_transactions tied to the purchase,
-- deletes the purchase row (removes it from Sales + Purchases dashboards), and
-- sets the listing back to active.
-- To also remove a pending test cash-out and wipe all related fake balance, use
-- scripts/043_remove_test_sale_and_cashout_complete.sql (or 042 for cash-out only).
--
-- Run in Supabase SQL Editor (postgres or service role).

-- ---------------------------------------------------------------------------
-- STEP 1 — Run this alone. Find your row and note purchases.id (reference_id).
-- ---------------------------------------------------------------------------
-- SELECT wt.created_at,
--        wt.amount,
--        wt.reference_id AS purchase_id,
--        wt.description,
--        p.amount AS purchase_amount,
--        p.stripe_checkout_session_id,
--        l.title AS listing_title
-- FROM public.wallet_transactions wt
-- LEFT JOIN public.purchases p ON p.id = wt.reference_id
-- LEFT JOIN public.listings l ON l.id = p.listing_id
-- WHERE wt.type = 'sale'
-- ORDER BY wt.created_at DESC
-- LIMIT 30;

-- ---------------------------------------------------------------------------
-- STEP 2 — If auto-match still fails, use MANUAL inside the block below.
-- Replace the whole CREATE TEMP TABLE … AS <query>; with:
--
--   CREATE TEMP TABLE _purge_purchase ON COMMIT DROP AS
--   SELECT id AS purchase_id, seller_id, buyer_id, listing_id, seller_earnings::numeric AS seller_earnings
--   FROM public.purchases
--   WHERE id = 'YOUR-PURCHASE-UUID'::uuid;

BEGIN;

-- Auto-match (prefer wallet row A, else Stripe purchase B):
--  reference_id is cast to text so uuid/text columns both join.
CREATE TEMP TABLE _purge_purchase ON COMMIT DROP AS
SELECT purchase_id, seller_id, buyer_id, listing_id, seller_earnings
FROM (
  (
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
      AND wt.description ILIKE '%Trip Plan Hull%'
    ORDER BY wt.created_at DESC
    LIMIT 1
  )
  UNION ALL
  (
    SELECT p.id,
           p.seller_id,
           p.buyer_id,
           p.listing_id,
           p.seller_earnings::numeric,
           2 AS pri
    FROM public.purchases p
    JOIN public.listings l ON l.id = p.listing_id
    WHERE p.status = 'confirmed'
      AND p.stripe_checkout_session_id IS NOT NULL
      AND trim(p.stripe_checkout_session_id) <> ''
      AND l.title ILIKE '%Trip Plan Hull%'
    ORDER BY p.created_at DESC
    LIMIT 1
  )
) sub
ORDER BY pri
LIMIT 1;

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*)::int INTO n FROM _purge_purchase;
  IF n = 0 THEN
    RAISE EXCEPTION
      'No matching purchase. Run STEP 1 SELECT, copy purchase_id, then use MANUAL block in CREATE TEMP TABLE (see script comments).';
  END IF;
END $$;

UPDATE public.wallets w
SET
  balance = (w.balance::numeric - p.seller_earnings)::numeric(10, 2),
  lifetime_earned = (w.lifetime_earned::numeric - p.seller_earnings)::numeric(10, 2),
  updated_at = now()
FROM _purge_purchase p
WHERE w.user_id = p.seller_id;

DELETE FROM public.wallet_transactions wt
USING _purge_purchase p
WHERE wt.reference_id = p.purchase_id
  AND wt.type IN ('sale', 'purchase');

DELETE FROM public.purchases pur
USING _purge_purchase p
WHERE pur.id = p.purchase_id;

UPDATE public.listings l
SET status = 'active'
FROM _purge_purchase p
WHERE l.id = p.listing_id;

COMMIT;

-- Stripe: this does not refund the test charge. In Stripe Dashboard (test mode),
-- refund or ignore the PaymentIntent/Checkout Session as you prefer.
