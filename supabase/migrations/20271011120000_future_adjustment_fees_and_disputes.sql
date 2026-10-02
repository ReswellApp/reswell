-- Past carrier adjustments stay off seller wallets. Rows that already exist are
-- marked not chargeable, and any wallet debit already posted for them is returned.
-- New adjustment rows default to chargeable. Sellers can dispute a future fee
-- with Reswell; Reswell then records the submission to UPS, FedEx, or USPS.

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
        'shipengine_label_adjustment',
        'shipengine_label_adjustment_reversal'
      )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_shipengine_label_adjustment_reversal_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'shipengine_label_adjustment_reversal';

ALTER TABLE public.shipengine_label_adjustments
  ADD COLUMN IF NOT EXISTS charge_seller_wallet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wallet_reversal_transaction_id uuid
    REFERENCES public.wallet_transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.shipengine_label_adjustments.charge_seller_wallet IS
  'True only for adjustments ingested after seller wallet deductions started. Existing rows stay false so past carrier bills are not deducted.';

-- Return any seller-wallet debits that already posted for adjustments on record now.
DO $$
DECLARE
  r_adjustment record;
  r_wallet public.wallets%ROWTYPE;
  v_existing uuid;
  v_tx uuid;
  v_amount numeric(12, 2);
  v_balance_after numeric(12, 2);
  v_spent numeric(12, 2);
  v_description text;
BEGIN
  FOR r_adjustment IN
    SELECT DISTINCT ON (a.wallet_transaction_id)
      a.wallet_transaction_id,
      abs(wt.amount) AS adjustment_amount_usd,
      wt.user_id AS seller_id
    FROM public.shipengine_label_adjustments a
    JOIN public.wallet_transactions wt ON wt.id = a.wallet_transaction_id
    WHERE a.wallet_reversal_transaction_id IS NULL
      AND wt.reference_type = 'shipengine_label_adjustment'
      AND wt.amount < 0
    ORDER BY a.wallet_transaction_id, a.created_at, a.id
  LOOP
    SELECT id
    INTO v_existing
    FROM public.wallet_transactions
    WHERE reference_type = 'shipengine_label_adjustment_reversal'
      AND reference_id = r_adjustment.wallet_transaction_id::text
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.shipengine_label_adjustments
      SET wallet_reversal_transaction_id = v_existing
      WHERE wallet_transaction_id = r_adjustment.wallet_transaction_id
        AND wallet_reversal_transaction_id IS NULL;
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
    v_balance_after := round(r_wallet.balance::numeric + v_amount, 2);
    v_spent := round(GREATEST(0, COALESCE(r_wallet.lifetime_spent, 0)::numeric - v_amount), 2);
    v_description := format(
      'Adjustment fee returned — $%s was returned to your balance. This carrier adjustment was recorded before Reswell started deducting adjustment fees from seller balances.',
      trim(to_char(v_amount, 'FM999999990.00'))
    );

    UPDATE public.wallets
    SET
      balance = v_balance_after,
      lifetime_spent = v_spent,
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
      'refund',
      v_amount,
      v_balance_after,
      left(v_description, 500),
      'completed',
      r_adjustment.wallet_transaction_id::text,
      'shipengine_label_adjustment_reversal'
    )
    RETURNING id INTO v_tx;

    UPDATE public.shipengine_label_adjustments
    SET wallet_reversal_transaction_id = v_tx
    WHERE wallet_transaction_id = r_adjustment.wallet_transaction_id
      AND wallet_reversal_transaction_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.shipengine_label_adjustments
  ALTER COLUMN charge_seller_wallet SET DEFAULT true;

DROP INDEX IF EXISTS public.shipengine_label_adjustments_wallet_pending_idx;
CREATE INDEX IF NOT EXISTS shipengine_label_adjustments_wallet_pending_idx
  ON public.shipengine_label_adjustments (created_at)
  WHERE charge_seller_wallet = true
    AND adjustment_amount_usd > 0
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
  v_order_label text;
  v_amount_label text;
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
    WHERE a.charge_seller_wallet = true
      AND a.adjustment_amount_usd > 0
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
    v_amount_label := trim(to_char(v_amount, 'FM999999990.00'));
    v_order_label := CASE
      WHEN NULLIF(trim(r_adjustment.order_num::text), '') IS NULL THEN 'this sale'
      ELSE '#' || trim(r_adjustment.order_num::text)
    END;

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
        'Adjustment fee — $%s was deducted from your balance for order %s. The buyer already paid the original shipping label. The carrier measured the packed package at %s and billed this extra amount. It is separate from the buyer payment and from your sale earnings.',
        v_amount_label,
        v_order_label,
        v_dimensions
      );
    ELSE
      v_description := format(
        'Adjustment fee — $%s was deducted from your balance for order %s. The buyer already paid the original shipping label. The carrier billed this extra amount because the packed package was larger or heavier than the label. It is separate from the buyer payment and from your sale earnings.',
        v_amount_label,
        v_order_label
      );
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
  'Debits seller wallets for positive ShipEngine adjustments ingested after seller charges started. Past rows stay charge_seller_wallet = false and are skipped.';

CREATE TABLE IF NOT EXISTS public.shipping_adjustment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES public.shipengine_label_adjustments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  carrier text NOT NULL CHECK (carrier IN ('ups', 'fedex', 'usps')),
  reason_code text NOT NULL CHECK (
    reason_code IN (
      'dimensions_match_label',
      'weight_match_label',
      'duplicate_charge',
      'wrong_package'
    )
  ),
  seller_statement text NOT NULL CHECK (char_length(trim(seller_statement)) BETWEEN 20 AND 2000),
  claimed_length_in numeric(8, 2),
  claimed_width_in numeric(8, 2),
  claimed_height_in numeric(8, 2),
  claimed_weight_lb numeric(8, 2),
  status text NOT NULL DEFAULT 'submitted_to_reswell' CHECK (
    status IN ('submitted_to_reswell', 'submitted_to_carrier', 'resolved', 'denied')
  ),
  reswell_note text,
  carrier_reference text,
  submitted_to_carrier_at timestamptz,
  submitted_to_carrier_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adjustment_id)
);

COMMENT ON TABLE public.shipping_adjustment_disputes IS
  'Seller dispute of a future carrier adjustment fee. The seller submits it to Reswell. Reswell then records the submission to UPS, FedEx, or USPS.';

CREATE INDEX IF NOT EXISTS shipping_adjustment_disputes_status_idx
  ON public.shipping_adjustment_disputes (status, created_at DESC);

CREATE INDEX IF NOT EXISTS shipping_adjustment_disputes_seller_idx
  ON public.shipping_adjustment_disputes (seller_id, created_at DESC);

ALTER TABLE public.shipping_adjustment_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipping_adjustment_disputes_select_seller
  ON public.shipping_adjustment_disputes;
CREATE POLICY shipping_adjustment_disputes_select_seller
  ON public.shipping_adjustment_disputes FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS shipping_adjustment_disputes_select_admin
  ON public.shipping_adjustment_disputes;
CREATE POLICY shipping_adjustment_disputes_select_admin
  ON public.shipping_adjustment_disputes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
