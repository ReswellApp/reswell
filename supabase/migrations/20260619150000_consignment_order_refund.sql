-- ─────────────────────────────────────────────────────────────────────────────
-- Consignment order refund: reverse the 3-way split atomically.
--
-- A consignment sale credits TWO wallets (consignor_earnings + shop_net_earnings). The existing
-- single-seller refund clawback (orders.seller_id / seller_earnings) would wrongly pull the
-- combined amount from the shop wallet alone and never touch the consignor. This RPC claws each
-- party back from their own wallet (pending first, then available — balance may go negative, same
-- policy as peer refunds), flips the order to refunded, and cancels the payout hold.
--
-- The Reswell platform fee is NOT held in any wallet, so a full buyer refund simply means the
-- platform absorbs its own fee — nothing to claw there.
--
-- Idempotent: presence of either refund ledger leg for the order short-circuits a second run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Permit the two refund-clawback reference types (preserve every existing value).
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
        'consignment_order_refund_shop'
      )
    );
END $$;

-- 2. One refund clawback row per party per order (defense-in-depth against double clawback).
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_consignment_refund_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type IN (
    'consignment_order_refund_consignor',
    'consignment_order_refund_shop'
  );

-- 3. Atomic split-aware refund.
CREATE OR REPLACE FUNCTION public.refund_consignment_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_order public.orders%ROWTYPE;
  v_listing_title text;
  v_consignor numeric(12, 2);
  v_shop numeric(12, 2);

  r_cw public.wallets%ROWTYPE;
  r_sw public.wallets%ROWTYPE;

  v_claw_pending numeric(12, 2);
  v_remainder numeric(12, 2);
  v_new_pending numeric(12, 2);
  v_new_balance numeric(12, 2);
  v_new_earned numeric(12, 2);
BEGIN
  -- Idempotency: a refund leg already recorded for this order.
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.reference_id = p_order_id::text
      AND wt.reference_type IN (
        'consignment_order_refund_consignor',
        'consignment_order_refund_shop'
      )
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

  v_consignor := COALESCE(r_order.consignor_earnings, 0);
  v_shop := COALESCE(r_order.shop_net_earnings, 0);

  SELECT COALESCE(l.title, 'Item') INTO v_listing_title
  FROM public.listings l WHERE l.id = r_order.listing_id;

  -- ── Consignor clawback (pending first, then available) ──────────────
  IF r_order.consignor_profile_id IS NOT NULL AND v_consignor > 0 THEN
    SELECT * INTO r_cw FROM public.wallets WHERE user_id = r_order.consignor_profile_id FOR UPDATE;
    IF FOUND THEN
      v_claw_pending := LEAST(v_consignor, GREATEST(0, round(r_cw.pending_balance::numeric, 2)));
      v_remainder := round(v_consignor - v_claw_pending, 2);
      v_new_pending := GREATEST(0, round(r_cw.pending_balance::numeric - v_claw_pending, 2));
      v_new_balance := round(r_cw.balance::numeric - v_remainder, 2);
      v_new_earned := GREATEST(0, round(r_cw.lifetime_earned::numeric - v_consignor, 2));

      UPDATE public.wallets
      SET balance = v_new_balance, pending_balance = v_new_pending,
          lifetime_earned = v_new_earned, updated_at = now()
      WHERE id = r_cw.id;

      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, status, reference_id, reference_type
      ) VALUES (
        r_cw.id, r_order.consignor_profile_id, 'refund', -v_consignor, v_new_balance,
        format('Refund — Consigned "%s" returned', v_listing_title),
        'completed', p_order_id::text, 'consignment_order_refund_consignor'
      );
    END IF;
  END IF;

  -- ── Shop commission clawback ────────────────────────────────────────
  IF v_shop > 0 THEN
    SELECT * INTO r_sw FROM public.wallets WHERE user_id = r_order.seller_id FOR UPDATE;
    IF FOUND THEN
      v_claw_pending := LEAST(v_shop, GREATEST(0, round(r_sw.pending_balance::numeric, 2)));
      v_remainder := round(v_shop - v_claw_pending, 2);
      v_new_pending := GREATEST(0, round(r_sw.pending_balance::numeric - v_claw_pending, 2));
      v_new_balance := round(r_sw.balance::numeric - v_remainder, 2);
      v_new_earned := GREATEST(0, round(r_sw.lifetime_earned::numeric - v_shop, 2));

      UPDATE public.wallets
      SET balance = v_new_balance, pending_balance = v_new_pending,
          lifetime_earned = v_new_earned, updated_at = now()
      WHERE id = r_sw.id;

      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, status, reference_id, reference_type
      ) VALUES (
        r_sw.id, r_order.seller_id, 'refund', -v_shop, v_new_balance,
        format('Refund — Commission on "%s" reversed', v_listing_title),
        'completed', p_order_id::text, 'consignment_order_refund_shop'
      );
    END IF;
  END IF;

  -- ── Order + payout hold ─────────────────────────────────────────────
  UPDATE public.orders
  SET status = 'refunded', refunded_at = now(), updated_at = now()
  WHERE id = p_order_id AND status IS DISTINCT FROM 'refunded';

  UPDATE public.payouts
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.refund_consignment_order(uuid) IS
  'Reverses a consignment order''s 3-way split: claws consignor_earnings and shop_net_earnings from their respective wallets (pending then available), marks the order refunded, and cancels the payout. Idempotent. Stripe card refund is issued separately by the caller.';

COMMIT;
