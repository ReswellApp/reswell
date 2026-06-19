-- ─────────────────────────────────────────────────────────────────────────────
-- Reconcile the shipping payout gate for consignment orders.
--
-- Peer orders release pending→available only after the admin/carrier shipping gate clears the
-- payout (payouts.status = 'pending' AND released_at IS NOT NULL) — see
-- release_order_seller_earnings_to_wallet. The consignment release RPC previously checked only
-- delivery_status, so for a SHIPPED consignment order it would release early if ever called before
-- the gate cleared. In practice both paths enter release via markShippingDeliveredAndReleaseSellerEarnings
-- (which clears the payout first), but the consignment RPC was defense-in-depth blind to the gate.
--
-- This re-creates release_consignment_order_earnings with the identical shipping gate. Pickup and
-- POS (delivery_status = 'picked_up') are unaffected and still release immediately.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.release_consignment_order_earnings(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_order public.orders%ROWTYPE;
  r_payout public.payouts%ROWTYPE;
  v_listing_title text;
  v_consignor numeric(12, 2);
  v_shop numeric(12, 2);

  -- consignor wallet
  r_cw public.wallets%ROWTYPE;
  v_cw_pending numeric(12, 2);
  v_cw_balance numeric(12, 2);

  -- shop wallet
  r_sw public.wallets%ROWTYPE;
  v_sw_pending numeric(12, 2);
  v_sw_balance numeric(12, 2);
BEGIN
  -- Idempotency: the consignor "available" leg is the completion marker.
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'consignment_order_consignor_earnings'
      AND wt.reference_id = p_order_id::text
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO r_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF r_order.consignment_store_id IS NULL THEN
    RAISE EXCEPTION 'not_a_consignment_order';
  END IF;
  IF r_order.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'order_not_active';
  END IF;
  IF r_order.delivery_status NOT IN ('delivered', 'picked_up') THEN
    RAISE EXCEPTION 'fulfillment_incomplete';
  END IF;

  -- Shipping gate: mirror the peer RPC — shipped orders only release once the payout hold has been
  -- cleared by the admin/carrier release path. Pickup/POS skip this gate.
  IF r_order.fulfillment_method IS NOT DISTINCT FROM 'shipping' THEN
    SELECT * INTO r_payout FROM public.payouts WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'payout_not_found';
    END IF;
    IF r_payout.status IS DISTINCT FROM 'pending' OR r_payout.released_at IS NULL THEN
      RAISE EXCEPTION 'shipping_payout_not_cleared_for_wallet_release';
    END IF;
  END IF;

  v_consignor := COALESCE(r_order.consignor_earnings, 0);
  v_shop := COALESCE(r_order.shop_net_earnings, 0);
  IF v_consignor < 0 OR v_shop < 0 THEN
    RAISE EXCEPTION 'invalid_split';
  END IF;

  SELECT COALESCE(l.title, 'Item') INTO v_listing_title
  FROM public.listings l WHERE l.id = r_order.listing_id;

  -- ── Consignor leg ───────────────────────────────────────────────
  IF r_order.consignor_profile_id IS NOT NULL AND v_consignor > 0 THEN
    SELECT * INTO r_cw FROM public.wallets WHERE user_id = r_order.consignor_profile_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.wallets (user_id) VALUES (r_order.consignor_profile_id) RETURNING * INTO r_cw;
    END IF;

    v_consignor := LEAST(v_consignor, round(r_cw.pending_balance::numeric, 2));
    IF v_consignor > 0 THEN
      v_cw_pending := GREATEST(0, round(r_cw.pending_balance::numeric - v_consignor, 2));
      v_cw_balance := round(r_cw.balance::numeric + v_consignor, 2);

      UPDATE public.wallets
      SET balance = v_cw_balance, pending_balance = v_cw_pending, updated_at = now()
      WHERE id = r_cw.id;

      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, reference_id, reference_type
      ) VALUES (
        r_cw.id, r_order.consignor_profile_id, 'sale', 0, v_cw_balance,
        format('Available — Consigned "%s" sold', v_listing_title),
        p_order_id::text, 'consignment_order_consignor_earnings'
      );
    END IF;
  END IF;

  -- ── Shop commission leg (seller_id is the store account) ─────────
  IF v_shop > 0 THEN
    SELECT * INTO r_sw FROM public.wallets WHERE user_id = r_order.seller_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.wallets (user_id) VALUES (r_order.seller_id) RETURNING * INTO r_sw;
    END IF;

    v_shop := LEAST(v_shop, round(r_sw.pending_balance::numeric, 2));
    IF v_shop > 0 THEN
      v_sw_pending := GREATEST(0, round(r_sw.pending_balance::numeric - v_shop, 2));
      v_sw_balance := round(r_sw.balance::numeric + v_shop, 2);

      UPDATE public.wallets
      SET balance = v_sw_balance, pending_balance = v_sw_pending, updated_at = now()
      WHERE id = r_sw.id;

      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, reference_id, reference_type
      ) VALUES (
        r_sw.id, r_order.seller_id, 'sale', 0, v_sw_balance,
        format('Available — Commission on "%s" (Reswell fee: $%s)',
               v_listing_title, trim(to_char(COALESCE(r_order.platform_fee, 0), 'FM999999990.00'))),
        p_order_id::text, 'consignment_order_shop_commission'
      );
    END IF;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.release_consignment_order_earnings(uuid) IS
  'Releases a consignment order''s pending earnings to both the consignor and shop wallets once fulfillment is complete. Shipping orders require the payout hold cleared (payouts.status = pending + released_at) like peer orders; pickup/POS release immediately. Idempotent.';

COMMIT;
