-- Shipping is no longer revenue for the seller and is no longer subject to the marketplace fee.
-- Only the listing (item) price counts toward platform_fee and seller_earnings; shipping is
-- collected separately and is fully Reswell's responsibility (carrier label costs etc.).
--
-- Forward-looking schema:
--   orders.shipping_amount  numeric(12,2) NOT NULL DEFAULT 0
--   orders.amount           = item_price + shipping_amount  (unchanged: total the buyer paid)
--   orders.platform_fee     = round(item_price * 0.07, 2)   (now: item-only)
--   orders.seller_earnings  = round(item_price - platform_fee, 2)
--
-- Backfill rules (applied to every existing row, not just confirmed):
--   * shipping_amount = greatest(0, amount - listings.price) when the order shipped, else 0
--   * platform_fee / seller_earnings recomputed from the implied item price
--   * payouts.amount aligned for non-paid payouts so cash-out math reflects the new earnings
--   * For status='confirmed' orders, the over-credited difference is removed from each seller's
--     wallet (pending first, then available), lifetime_earned reduced, and a single
--     `wallet_transactions` adjustment row is written per affected seller for transparency.
--   * Existing `Pending — Sold` and `Available — Sold` ledger descriptions are rewritten so the
--     "(7% fee: $X.XX …)" amount matches the new platform_fee.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_amount numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.shipping_amount IS
  'Buyer-paid shipping included in `amount`. Excluded from platform_fee and seller_earnings — Reswell uses it to cover the carrier label.';

-- ── 1. Capture the per-order recompute up front (before mutating orders) ────────────────────────
DROP TABLE IF EXISTS _orders_fee_recompute;
CREATE TEMP TABLE _orders_fee_recompute ON COMMIT DROP AS
WITH base AS (
  SELECT
    o.id                       AS order_id,
    o.seller_id,
    o.status,
    o.delivery_status,
    o.amount                   AS amount,
    o.platform_fee             AS old_platform_fee,
    o.seller_earnings          AS old_seller_earnings,
    o.fulfillment_method,
    l.price                    AS listing_price,
    l.shipping_available       AS listing_shipping_available,
    l.local_pickup             AS listing_local_pickup
  FROM public.orders o
  JOIN public.listings l ON l.id = o.listing_id
),
classified AS (
  SELECT
    base.*,
    CASE
      WHEN base.fulfillment_method = 'shipping' THEN true
      WHEN base.fulfillment_method IS NULL
        AND COALESCE(base.listing_shipping_available, false) = true
        AND COALESCE(base.listing_local_pickup, true) = false THEN true
      ELSE false
    END AS is_shipping
  FROM base
),
shipping_resolved AS (
  SELECT
    classified.*,
    CASE
      WHEN classified.is_shipping THEN
        GREATEST(0, ROUND((classified.amount - COALESCE(classified.listing_price, classified.amount))::numeric, 2))
      ELSE 0
    END AS shipping_amount
  FROM classified
),
finalized AS (
  SELECT
    sr.*,
    ROUND((sr.amount - sr.shipping_amount)::numeric, 2) AS item_price
  FROM shipping_resolved sr
)
SELECT
  fn.order_id,
  fn.seller_id,
  fn.status,
  fn.delivery_status,
  fn.amount,
  fn.old_platform_fee,
  fn.old_seller_earnings,
  fn.shipping_amount,
  fn.item_price,
  ROUND(fn.item_price * 7 / 100, 2)                                         AS new_platform_fee,
  ROUND(fn.item_price - ROUND(fn.item_price * 7 / 100, 2), 2)               AS new_seller_earnings,
  ROUND(fn.old_seller_earnings - (fn.item_price - ROUND(fn.item_price * 7 / 100, 2)), 2) AS seller_overcredit
FROM finalized fn;

CREATE INDEX ON _orders_fee_recompute (seller_id);
CREATE INDEX ON _orders_fee_recompute (status);

-- ── 2. Per-seller wallet adjustment (only for orders still in `confirmed` state) ───────────────
-- Refunded orders already had their seller earnings reversed at the (old, larger) amount, so the
-- shipping over-credit was clawed back too — nothing to do for those.
DROP TABLE IF EXISTS _seller_wallet_adjustments;
CREATE TEMP TABLE _seller_wallet_adjustments ON COMMIT DROP AS
SELECT
  rc.seller_id,
  COALESCE(SUM(
    CASE
      WHEN rc.delivery_status IN ('delivered', 'picked_up') THEN GREATEST(0, rc.seller_overcredit)
      ELSE 0
    END
  ), 0) AS overcredit_in_balance,
  COALESCE(SUM(
    CASE
      WHEN rc.delivery_status NOT IN ('delivered', 'picked_up') THEN GREATEST(0, rc.seller_overcredit)
      ELSE 0
    END
  ), 0) AS overcredit_in_pending,
  COALESCE(SUM(GREATEST(0, rc.seller_overcredit)), 0) AS overcredit_total,
  COUNT(*) FILTER (WHERE rc.seller_overcredit > 0) AS affected_orders
FROM _orders_fee_recompute rc
WHERE rc.status = 'confirmed'
GROUP BY rc.seller_id
HAVING SUM(GREATEST(0, rc.seller_overcredit)) > 0;

-- Actually apply the wallet rebalance: pending shrinks first, then available (`balance`).
-- Production may enforce CHECK e.g. `positive_balance` (balance >= 0). Cap deducted balance so
-- the row never violates that. `lifetime_earned` drops only by amounts actually clawed back.

DROP TABLE IF EXISTS _wallet_shipping_correction;
CREATE TEMP TABLE _wallet_shipping_correction ON COMMIT DROP AS
WITH adj AS (
  SELECT
    w.id                         AS wallet_id,
    w.user_id                    AS seller_id,
    w.balance::numeric           AS old_balance,
    w.pending_balance::numeric   AS old_pending,
    w.lifetime_earned::numeric   AS old_earned,
    sa.overcredit_in_pending,
    sa.overcredit_in_balance,
    sa.overcredit_total,
    sa.affected_orders
  FROM public.wallets w
  JOIN _seller_wallet_adjustments sa ON sa.seller_id = w.user_id
),
computed AS (
  SELECT
    adj.*,
    ROUND(
      GREATEST(
        0::numeric,
        adj.old_pending - LEAST(adj.overcredit_in_pending, adj.old_pending)
      ),
      2
    ) AS new_pending,
    ROUND(
      adj.old_balance
      - (
        adj.overcredit_in_balance
        + GREATEST(0::numeric, adj.overcredit_in_pending - adj.old_pending)
      ),
      2
    ) AS desired_balance_raw
  FROM adj
)
SELECT
  c.wallet_id,
  c.seller_id,
  c.old_balance,
  c.old_pending,
  c.old_earned,
  c.overcredit_total,
  c.affected_orders,
  c.new_pending,
  ROUND(GREATEST(0::numeric, c.desired_balance_raw), 2) AS new_balance,
  ROUND(
    (c.old_pending - c.new_pending)
      + (
        c.old_balance - ROUND(GREATEST(0::numeric, c.desired_balance_raw), 2)
      ),
    2
  ) AS actual_clawback
FROM computed c;

UPDATE public.wallets w
SET
  pending_balance = cor.new_pending,
  balance = cor.new_balance,
  lifetime_earned = ROUND(GREATEST(0::numeric, cor.old_earned - cor.actual_clawback), 2),
  updated_at = now()
FROM _wallet_shipping_correction cor
WHERE w.id = cor.wallet_id;

-- Make sure the constraint on wallet_transactions.reference_type accepts our adjustment row.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallet_transactions_reference_type_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions
      DROP CONSTRAINT wallet_transactions_reference_type_check;
  END IF;

  ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_reference_type_check
    CHECK (
      reference_type IS NULL
      OR reference_type IN (
        'listing',
        'order_pending_earnings',
        'order_seller_earnings',
        'stripe_refund',
        'wallet_refund',
        'stripe_connect_transfer',
        'paypal_payout',
        'shipping_fee_correction'
      )
    );
END $$;

-- One ledger row per affected seller documenting the rebalance.
INSERT INTO public.wallet_transactions (
  wallet_id,
  user_id,
  type,
  amount,
  balance_after,
  description,
  reference_id,
  reference_type
)
SELECT
  w.id,
  w.user_id,
  'refund',
  -cor.actual_clawback,
  w.balance,
  CASE
    WHEN ROUND(cor.overcredit_total - cor.actual_clawback, 2) <= 0 THEN
      format(
        'Adjustment — shipping no longer counts toward seller earnings (recalculated %s order%s; -$%s reversed from pending/available).',
        cor.affected_orders,
        CASE WHEN cor.affected_orders = 1 THEN '' ELSE 's' END,
        trim(to_char(cor.actual_clawback, 'FM999999990.00'))
      )
    ELSE
      format(
        'Adjustment — shipping no longer counts toward seller earnings (recalculated %s order%s; -$%s reversed from pending/available; $%s not recoverable due to wallet balance floor — contact support if needed).',
        cor.affected_orders,
        CASE WHEN cor.affected_orders = 1 THEN '' ELSE 's' END,
        trim(to_char(cor.actual_clawback, 'FM999999990.00')),
        trim(to_char((cor.overcredit_total - cor.actual_clawback), 'FM999999990.00'))
      )
  END,
  w.user_id::text,
  'shipping_fee_correction'
FROM _wallet_shipping_correction cor
JOIN public.wallets w ON w.id = cor.wallet_id
WHERE cor.actual_clawback > 0;

-- ── 3. Apply the recomputed values to orders + payouts ──────────────────────────────────────────
UPDATE public.orders o
SET
  shipping_amount = rc.shipping_amount,
  platform_fee = rc.new_platform_fee,
  seller_earnings = rc.new_seller_earnings,
  updated_at = now()
FROM _orders_fee_recompute rc
WHERE o.id = rc.order_id
  AND (
    o.shipping_amount IS DISTINCT FROM rc.shipping_amount
    OR o.platform_fee IS DISTINCT FROM rc.new_platform_fee
    OR o.seller_earnings IS DISTINCT FROM rc.new_seller_earnings
  );

UPDATE public.payouts p
SET
  amount = rc.new_seller_earnings,
  updated_at = now()
FROM _orders_fee_recompute rc
WHERE p.order_id = rc.order_id
  AND p.status NOT IN ('paid', 'cancelled', 'failed', 'processing')
  AND p.amount IS DISTINCT FROM rc.new_seller_earnings;

-- ── 4. Repoint old "Pending — Sold" / "Available — Sold" ledger descriptions ───────────────────
-- They embed "(7% fee: $X.XX …)" using the old (inflated) platform_fee. Rewrite the dollar
-- amount inline so sellers don't see stale numbers in their Activity feed.
UPDATE public.wallet_transactions wt
SET description = regexp_replace(
  wt.description,
  '7% fee: \$\d+(?:\.\d+)?',
  format('7%% fee: $%s', trim(to_char(rc.new_platform_fee, 'FM999999990.00'))),
  'g'
)
FROM _orders_fee_recompute rc
WHERE wt.reference_type IN ('order_pending_earnings', 'order_seller_earnings')
  AND wt.reference_id = rc.order_id::text
  AND wt.description ~ '7% fee: \$\d+(?:\.\d+)?'
  AND rc.new_platform_fee IS DISTINCT FROM rc.old_platform_fee;

COMMIT;
