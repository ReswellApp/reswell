-- Reverse mistaken seller wallet credits from admin terminal cash sales.
-- Cash collected at the register never flows through Stripe or the marketplace wallet ledger.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
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
        'shipping_fee_correction',
        'consignment_order_pending_consignor',
        'consignment_order_pending_shop',
        'consignment_order_consignor_earnings',
        'consignment_order_shop_commission',
        'consignment_order_refund_consignor',
        'consignment_order_refund_shop',
        'seller_shipping_label',
        'seller_flat_shipping_surplus',
        'admin_terminal_cash_wallet_correction'
      )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_admin_terminal_cash_wallet_correction_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'admin_terminal_cash_wallet_correction';

DROP TABLE IF EXISTS _admin_terminal_cash_wallet_orders;
CREATE TEMP TABLE _admin_terminal_cash_wallet_orders ON COMMIT DROP AS
SELECT
  o.id AS order_id,
  o.seller_id,
  ROUND(o.seller_earnings::numeric, 2) AS seller_earnings,
  EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'order_seller_earnings'
      AND wt.reference_id = o.id::text
  ) AS released_to_balance
FROM public.orders o
WHERE o.payment_method = 'cash'
  AND o.sales_channel = 'admin_terminal'
  AND o.status = 'confirmed'
  AND ROUND(COALESCE(o.seller_earnings, 0)::numeric, 2) > 0
  AND EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'order_pending_earnings'
      AND wt.reference_id = o.id::text
      AND wt.amount > 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'admin_terminal_cash_wallet_correction'
      AND wt.reference_id = o.seller_id::text
  );

CREATE INDEX ON _admin_terminal_cash_wallet_orders (seller_id);

DROP TABLE IF EXISTS _seller_admin_terminal_cash_adjustments;
CREATE TEMP TABLE _seller_admin_terminal_cash_adjustments ON COMMIT DROP AS
SELECT
  ao.seller_id,
  COALESCE(SUM(
    CASE
      WHEN ao.released_to_balance THEN GREATEST(0, ao.seller_earnings)
      ELSE 0
    END
  ), 0) AS overcredit_in_balance,
  COALESCE(SUM(
    CASE
      WHEN NOT ao.released_to_balance THEN GREATEST(0, ao.seller_earnings)
      ELSE 0
    END
  ), 0) AS overcredit_in_pending,
  COALESCE(SUM(GREATEST(0, ao.seller_earnings)), 0) AS overcredit_total,
  COUNT(*) AS affected_orders
FROM _admin_terminal_cash_wallet_orders ao
GROUP BY ao.seller_id
HAVING SUM(GREATEST(0, ao.seller_earnings)) > 0;

DROP TABLE IF EXISTS _wallet_admin_terminal_cash_correction;
CREATE TEMP TABLE _wallet_admin_terminal_cash_correction ON COMMIT DROP AS
WITH adj AS (
  SELECT
    w.id AS wallet_id,
    w.user_id AS seller_id,
    w.balance::numeric AS old_balance,
    w.pending_balance::numeric AS old_pending,
    w.lifetime_earned::numeric AS old_earned,
    sa.overcredit_in_pending,
    sa.overcredit_in_balance,
    sa.overcredit_total,
    sa.affected_orders
  FROM public.wallets w
  JOIN _seller_admin_terminal_cash_adjustments sa ON sa.seller_id = w.user_id
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
      + (c.old_balance - ROUND(GREATEST(0::numeric, c.desired_balance_raw), 2)),
    2
  ) AS actual_clawback
FROM computed c;

UPDATE public.wallets w
SET
  pending_balance = cor.new_pending,
  balance = cor.new_balance,
  lifetime_earned = ROUND(GREATEST(0::numeric, cor.old_earned - cor.actual_clawback), 2),
  updated_at = now()
FROM _wallet_admin_terminal_cash_correction cor
WHERE w.id = cor.wallet_id
  AND cor.actual_clawback > 0;

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
        'Adjustment — admin terminal cash sales are not wallet payouts (%s order%s; -$%s reversed from pending/available).',
        cor.affected_orders,
        CASE WHEN cor.affected_orders = 1 THEN '' ELSE 's' END,
        trim(to_char(cor.actual_clawback, 'FM999999990.00'))
      )
    ELSE
      format(
        'Adjustment — admin terminal cash sales are not wallet payouts (%s order%s; -$%s reversed from pending/available; $%s not recoverable due to wallet balance floor — contact support if needed).',
        cor.affected_orders,
        CASE WHEN cor.affected_orders = 1 THEN '' ELSE 's' END,
        trim(to_char(cor.actual_clawback, 'FM999999990.00')),
        trim(to_char((cor.overcredit_total - cor.actual_clawback), 'FM999999990.00'))
      )
  END,
  w.user_id::text,
  'admin_terminal_cash_wallet_correction'
FROM _wallet_admin_terminal_cash_correction cor
JOIN public.wallets w ON w.id = cor.wallet_id
WHERE cor.actual_clawback > 0;

COMMIT;
