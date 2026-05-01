-- Shipping-only: payouts must not sit as status = 'pending' while the order is still pre-delivery (bad backfills).
-- The wallet RPC must not credit shipping seller earnings until the payouts row was advanced to pending with
-- released_at (admin "Approve payout"). Local pickup is unchanged: verify_order_pickup_for_seller still sets the
-- payout row, but this function does not require that pickup path for wallet credit.

-- ── 0. Align CHECK constraints (repair UPDATE uses status = held + hold_reason including awaiting_manual_release).
--     Databases that skipped earlier migrations may still have the original hold_reason list without
--     awaiting_manual_release, which makes the UPDATE fail (sometimes reported as payouts_status_check).
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_hold_reason_check;
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_hold_reason_check
  CHECK (
    hold_reason IS NULL
    OR hold_reason IN (
      'awaiting_shipment',
      'awaiting_delivery',
      'awaiting_manual_release',
      'awaiting_pickup'
    )
  );

ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_status_check;
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_status_check
  CHECK (
    status IN (
      'held',
      'pending',
      'processing',
      'paid',
      'failed',
      'cancelled'
    )
  );

COMMENT ON COLUMN public.payouts.hold_reason IS
  'awaiting_shipment: no tracking. awaiting_delivery: in transit / not yet verified delivered. awaiting_manual_release: buyer verified receipt; funds released by admin. awaiting_pickup: local pickup.';

-- ── 1. Repair inconsistent shipping ledger rows ─────────────────────────────
UPDATE public.payouts p
SET
  status = 'held',
  hold_reason = CASE
    WHEN o.delivery_status = 'shipped' THEN 'awaiting_delivery'
    WHEN o.delivery_status = 'delivered' THEN 'awaiting_manual_release'
    ELSE 'awaiting_shipment'
  END,
  released_at = NULL,
  updated_at = now()
FROM public.orders o
WHERE p.order_id = o.id
  AND o.fulfillment_method = 'shipping'
  AND o.status = 'confirmed'
  AND p.status = 'pending'
  AND (
    p.released_at IS NULL
    OR o.delivery_status IS DISTINCT FROM 'delivered'
  );

-- ── 2. Wallet RPC: shipping orders only — require payout cleared (pending + released_at) ──
CREATE OR REPLACE FUNCTION public.release_order_seller_earnings_to_wallet(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_order public.orders%ROWTYPE;
  r_payout public.payouts%ROWTYPE;
  r_wallet public.wallets%ROWTYPE;
  v_listing_title text;
  v_desc text;
  v_earn numeric(12, 2);
  v_new_bal numeric(12, 2);
  v_new_pending numeric(12, 2);
  v_pm_suffix text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'order_seller_earnings'
      AND wt.reference_id = p_order_id::text
  ) THEN
    RETURN false;
  END IF;

  SELECT *
  INTO r_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF r_order.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'order_not_active';
  END IF;

  IF r_order.delivery_status NOT IN ('delivered', 'picked_up') THEN
    RAISE EXCEPTION 'fulfillment_incomplete';
  END IF;

  IF r_order.fulfillment_method IS NOT DISTINCT FROM 'shipping' THEN
    SELECT *
    INTO r_payout
    FROM public.payouts
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payout_not_found';
    END IF;

    IF r_payout.status IS DISTINCT FROM 'pending' OR r_payout.released_at IS NULL THEN
      RAISE EXCEPTION 'shipping_payout_not_cleared_for_wallet_release';
    END IF;
  END IF;

  v_earn := r_order.seller_earnings;
  IF v_earn IS NULL OR v_earn < 0 THEN
    RAISE EXCEPTION 'invalid_earnings';
  END IF;

  SELECT COALESCE(l.title, 'Item')
  INTO v_listing_title
  FROM public.listings l
  WHERE l.id = r_order.listing_id;

  SELECT *
  INTO r_wallet
  FROM public.wallets
  WHERE user_id = r_order.seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id)
    VALUES (r_order.seller_id)
    RETURNING *
    INTO r_wallet;
  END IF;

  v_earn := LEAST(v_earn, round(r_wallet.pending_balance::numeric, 2));
  IF v_earn <= 0 THEN
    RAISE EXCEPTION 'pending_balance_insufficient';
  END IF;

  v_pm_suffix :=
    CASE WHEN r_order.payment_method = 'stripe' THEN ', card' ELSE '' END;

  v_desc :=
    format(
      'Available — Sold "%s" (7%% fee: $%s%s)',
      v_listing_title,
      trim(to_char(r_order.platform_fee, 'FM999999990.00')),
      v_pm_suffix
    );

  v_new_pending := round(r_wallet.pending_balance::numeric - v_earn, 2);
  v_new_bal := round(r_wallet.balance::numeric + v_earn, 2);

  IF v_new_pending < 0 THEN
    v_new_pending := 0;
  END IF;

  UPDATE public.wallets w
  SET
    balance = v_new_bal,
    pending_balance = v_new_pending,
    updated_at = now()
  WHERE w.id = r_wallet.id;

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
  VALUES (
    r_wallet.id,
    r_order.seller_id,
    'sale',
    0,
    v_new_bal,
    v_desc,
    p_order_id::text,
    'order_seller_earnings'
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.release_order_seller_earnings_to_wallet(uuid) IS
  'Moves seller earnings from pending_balance to balance when fulfillment is complete. For shipping orders only, requires payouts.status = pending and released_at set (admin release). Pickup: unchanged (delivery picked_up + existing checks).';
