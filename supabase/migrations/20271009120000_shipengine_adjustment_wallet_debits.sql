-- Charge sellers for positive post-shipment ShipEngine label adjustments.
-- The ledger reference and row lock make repeated webhook/cron deliveries idempotent.

ALTER TABLE public.shipengine_label_adjustments
  ADD COLUMN IF NOT EXISTS wallet_transaction_id uuid
    REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wallet_debited_at timestamptz;

COMMENT ON COLUMN public.shipengine_label_adjustments.wallet_transaction_id IS
  'Seller wallet ledger debit created for this carrier adjustment.';

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
        'admin_terminal_cash_wallet_correction',
        'board_buy_payout',
        'order_item_return_refund',
        'protection_repair_credit',
        'shipengine_label_adjustment'
      )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_shipengine_label_adjustment_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'shipengine_label_adjustment';

CREATE INDEX IF NOT EXISTS shipengine_label_adjustments_wallet_pending_idx
  ON public.shipengine_label_adjustments (created_at)
  WHERE adjustment_amount_usd > 0
    AND order_id IS NOT NULL
    AND wallet_transaction_id IS NULL;

CREATE OR REPLACE FUNCTION public.apply_shipengine_label_adjustment_debits(
  p_limit integer DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_adjustment record;
  r_wallet public.wallets%ROWTYPE;
  v_existing_transaction_id uuid;
  v_transaction_id uuid;
  v_amount numeric(12, 2);
  v_balance_after numeric(12, 2);
  v_dimensions text;
  v_description text;
  v_processed integer := 0;
  v_charged integer := 0;
  v_already_charged integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid_limit';
  END IF;

  FOR r_adjustment IN
    SELECT
      a.id,
      COALESCE(NULLIF(trim(a.adjustment_id), ''), a.transaction_id) AS debit_reference_id,
      a.adjustment_amount_usd,
      a.actual_length,
      a.actual_width,
      a.actual_height,
      a.tracking_number,
      o.seller_id,
      o.order_num
    FROM public.shipengine_label_adjustments a
    JOIN public.orders o ON o.id = a.order_id
    WHERE a.adjustment_amount_usd > 0
      AND a.wallet_transaction_id IS NULL
    ORDER BY a.created_at, a.id
    LIMIT p_limit
    FOR UPDATE OF a SKIP LOCKED
  LOOP
    v_processed := v_processed + 1;

    SELECT wt.id
    INTO v_existing_transaction_id
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'shipengine_label_adjustment'
      AND wt.reference_id = r_adjustment.debit_reference_id
    LIMIT 1;

    IF v_existing_transaction_id IS NOT NULL THEN
      UPDATE public.shipengine_label_adjustments
      SET
        wallet_transaction_id = v_existing_transaction_id,
        wallet_debited_at = COALESCE(wallet_debited_at, now())
      WHERE id = r_adjustment.id;
      v_already_charged := v_already_charged + 1;
      CONTINUE;
    END IF;

    SELECT *
    INTO r_wallet
    FROM public.wallets
    WHERE user_id = r_adjustment.seller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.wallets (user_id)
      VALUES (r_adjustment.seller_id)
      RETURNING * INTO r_wallet;
    END IF;

    v_amount := round(r_adjustment.adjustment_amount_usd::numeric, 2);
    v_balance_after := round(r_wallet.balance::numeric - v_amount, 2);

    IF COALESCE(r_adjustment.actual_length, 0) > 0
      OR COALESCE(r_adjustment.actual_width, 0) > 0
      OR COALESCE(r_adjustment.actual_height, 0) > 0 THEN
      v_dimensions := format(
        '%s × %s × %s in',
        COALESCE(trim(to_char(r_adjustment.actual_length, 'FM999999990.##')), 'unknown'),
        COALESCE(trim(to_char(r_adjustment.actual_width, 'FM999999990.##')), 'unknown'),
        COALESCE(trim(to_char(r_adjustment.actual_height, 'FM999999990.##')), 'unknown')
      );
      v_description := format(
        'Shipping label adjustment — The carrier measured your package at %s. To prevent future charges, the packed package must fit within or under the dimensions on the purchased label.',
        v_dimensions
      );
    ELSE
      v_description :=
        'Shipping label adjustment — The carrier measured a package size above the purchased label. To prevent future charges, the packed package must fit within or under the dimensions on the purchased label.';
    END IF;

    UPDATE public.wallets
    SET
      balance = v_balance_after,
      lifetime_spent = round(COALESCE(lifetime_spent, 0)::numeric + v_amount, 2),
      updated_at = now()
    WHERE id = r_wallet.id;

    INSERT INTO public.wallet_transactions (
      wallet_id,
      user_id,
      type,
      amount,
      balance_after,
      description,
      status,
      reference_id,
      reference_type
    ) VALUES (
      r_wallet.id,
      r_adjustment.seller_id,
      'purchase',
      -v_amount,
      v_balance_after,
      left(v_description, 500),
      'completed',
      r_adjustment.debit_reference_id,
      'shipengine_label_adjustment'
    )
    RETURNING id INTO v_transaction_id;

    UPDATE public.shipengine_label_adjustments
    SET
      wallet_transaction_id = v_transaction_id,
      wallet_debited_at = now()
    WHERE id = r_adjustment.id;

    v_charged := v_charged + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'charged', v_charged,
    'already_charged', v_already_charged
  );
END;
$$;

COMMENT ON FUNCTION public.apply_shipengine_label_adjustment_debits(integer) IS
  'Atomically and idempotently debits seller wallets for matched positive ShipEngine label adjustments. Available balance may become negative.';

REVOKE ALL ON FUNCTION public.apply_shipengine_label_adjustment_debits(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_shipengine_label_adjustment_debits(integer) TO service_role;
