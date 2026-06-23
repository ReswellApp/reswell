-- Seller shipping labels: pay with in-wallet Reswell balance (earnings) instead of card.

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
        'seller_shipping_label'
      )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_seller_shipping_label_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'seller_shipping_label';

CREATE OR REPLACE FUNCTION public.deduct_wallet_for_internal_spend (
  p_user_id uuid,
  p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_wallet public.wallets%ROWTYPE;
  v_amount numeric(12, 2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_amount := round(p_amount::numeric, 2);

  UPDATE public.wallets w
  SET
    balance = round(w.balance::numeric - v_amount, 2),
    lifetime_spent = round(w.lifetime_spent::numeric + v_amount, 2),
    updated_at = now()
  WHERE w.user_id = p_user_id
    AND round(w.balance::numeric, 2) >= v_amount
  RETURNING * INTO r_wallet;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'wallet_id', r_wallet.id,
    'balance_after', r_wallet.balance,
    'lifetime_spent_after', r_wallet.lifetime_spent
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_for_internal_spend IS
  'Atomically debits spendable wallet balance for an in-app purchase (e.g. seller shipping label). Returns NULL when balance is insufficient.';

CREATE OR REPLACE FUNCTION public.refund_wallet_internal_spend (
  p_user_id uuid,
  p_amount numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.wallets w
  SET
    balance = round(w.balance::numeric + round(p_amount::numeric, 2), 2),
    lifetime_spent = GREATEST(
      0::numeric,
      round(w.lifetime_spent::numeric - round(p_amount::numeric, 2), 2)
    ),
    updated_at = now()
  WHERE w.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.refund_wallet_internal_spend IS
  'Restores spendable wallet balance after a failed in-app purchase debit (e.g. label purchase failed after wallet charge).';

REVOKE ALL ON FUNCTION public.deduct_wallet_for_internal_spend(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_wallet_internal_spend(uuid, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.deduct_wallet_for_internal_spend(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_wallet_internal_spend(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_for_internal_spend(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_wallet_internal_spend(uuid, numeric) TO authenticated;
