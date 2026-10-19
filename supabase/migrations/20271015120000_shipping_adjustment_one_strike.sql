-- One covered carrier adjustment per seller. Later positive adjustments are
-- deducted from that sale's earnings (pending balance, then available balance)
-- and never push wallets.balance below zero.

ALTER TABLE public.shipengine_label_adjustments
  ADD COLUMN IF NOT EXISTS coverage text,
  ADD COLUMN IF NOT EXISTS earnings_deducted_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS seller_notified_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipengine_label_adjustments_coverage_check'
      AND conrelid = 'public.shipengine_label_adjustments'::regclass
  ) THEN
    ALTER TABLE public.shipengine_label_adjustments
      ADD CONSTRAINT shipengine_label_adjustments_coverage_check
      CHECK (
        coverage IS NULL
        OR coverage IN ('covered_strike', 'charged_to_earnings', 'legacy_absorbed')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.shipengine_label_adjustments.coverage IS
  'covered_strike = this seller''s one Reswell-covered adjustment. charged_to_earnings = deducted from that sale. legacy_absorbed = older bill Reswell kept and did not charge.';

COMMENT ON COLUMN public.shipengine_label_adjustments.earnings_deducted_usd IS
  'Amount removed from the seller earnings on this sale. Capped at the sale earnings. Zero when Reswell covers the adjustment.';

CREATE TABLE IF NOT EXISTS public.seller_shipping_adjustment_strikes (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  adjustment_id uuid NOT NULL UNIQUE REFERENCES public.shipengine_label_adjustments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.seller_shipping_adjustment_strikes IS
  'The single carrier adjustment Reswell covers for a seller. The next adjustment on a shipped item is deducted from that sale''s earnings.';

ALTER TABLE public.seller_shipping_adjustment_strikes ENABLE ROW LEVEL SECURITY;

-- Existing positive adjustments: the earliest matched sale per seller is the covered strike.
-- Older extra bills that were never charged stay legacy_absorbed. Chargeable rows with no
-- coverage are applied by apply_shipengine_label_adjustment_debits.
INSERT INTO public.seller_shipping_adjustment_strikes (seller_id, adjustment_id)
SELECT DISTINCT ON (o.seller_id)
  o.seller_id,
  a.id
FROM public.shipengine_label_adjustments a
JOIN public.orders o ON o.id = a.order_id
WHERE a.adjustment_amount_usd > 0
  AND o.seller_id IS NOT NULL
  AND o.is_admin_test IS NOT TRUE
ORDER BY o.seller_id, a.adjustment_at ASC NULLS LAST, a.created_at ASC, a.id ASC
ON CONFLICT (seller_id) DO NOTHING;

UPDATE public.shipengine_label_adjustments a
SET
  coverage = 'covered_strike',
  earnings_deducted_usd = 0
FROM public.seller_shipping_adjustment_strikes s
WHERE s.adjustment_id = a.id
  AND a.coverage IS NULL;

UPDATE public.shipengine_label_adjustments a
SET
  coverage = 'legacy_absorbed',
  earnings_deducted_usd = 0
FROM public.orders o
WHERE a.order_id = o.id
  AND a.coverage IS NULL
  AND a.adjustment_amount_usd > 0
  AND (
    a.charge_seller_wallet = false
    OR o.is_admin_test IS TRUE
    OR o.status IN ('refunded', 'refunding', 'cancelled')
  );

CREATE INDEX IF NOT EXISTS shipengine_label_adjustments_seller_notify_idx
  ON public.shipengine_label_adjustments (created_at)
  WHERE seller_notified_at IS NULL
    AND coverage IN ('covered_strike', 'charged_to_earnings')
    AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_shipengine_label_adjustment_debits(
  p_limit integer DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_adjustment record;
  r_order public.orders%ROWTYPE;
  r_wallet public.wallets%ROWTYPE;
  v_existing_transaction_id uuid;
  v_transaction_id uuid;
  v_strike_seller uuid;
  v_amount numeric(12, 2);
  v_deduct numeric(12, 2);
  v_take numeric(12, 2);
  v_released boolean;
  v_balance_after numeric(12, 2);
  v_dimensions text;
  v_order_label text;
  v_amount_label text;
  v_description text;
  v_processed integer := 0;
  v_charged integer := 0;
  v_covered integer := 0;
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
    WHERE a.coverage IS NULL
      AND a.charge_seller_wallet = true
      AND a.adjustment_amount_usd > 0
      AND a.wallet_transaction_id IS NULL
    ORDER BY a.adjustment_at NULLS LAST, a.created_at, a.id
    LIMIT p_limit
    FOR UPDATE OF a SKIP LOCKED
  LOOP
    v_processed := v_processed + 1;
    v_transaction_id := NULL;
    v_strike_seller := NULL;
    v_existing_transaction_id := NULL;

    SELECT wt.id
    INTO v_existing_transaction_id
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'shipengine_label_adjustment'
      AND wt.reference_id = r_adjustment.debit_reference_id
    LIMIT 1;

    IF v_existing_transaction_id IS NOT NULL THEN
      UPDATE public.shipengine_label_adjustments
      SET
        coverage = COALESCE(coverage, 'charged_to_earnings'),
        earnings_deducted_usd = COALESCE(earnings_deducted_usd, round(r_adjustment.adjustment_amount_usd::numeric, 2)),
        wallet_transaction_id = v_existing_transaction_id,
        wallet_debited_at = COALESCE(wallet_debited_at, now())
      WHERE id = r_adjustment.id;
      v_already_charged := v_already_charged + 1;
      CONTINUE;
    END IF;

    SELECT *
    INTO r_order
    FROM public.orders
    WHERE id = (
      SELECT order_id FROM public.shipengine_label_adjustments WHERE id = r_adjustment.id
    )
    FOR UPDATE;

    IF NOT FOUND
      OR r_order.seller_id IS NULL
      OR r_order.is_admin_test IS TRUE
      OR r_order.status IN ('refunded', 'refunding', 'cancelled') THEN
      UPDATE public.shipengine_label_adjustments
      SET
        coverage = 'legacy_absorbed',
        earnings_deducted_usd = 0
      WHERE id = r_adjustment.id;
      CONTINUE;
    END IF;

    INSERT INTO public.seller_shipping_adjustment_strikes (seller_id, adjustment_id)
    VALUES (r_order.seller_id, r_adjustment.id)
    ON CONFLICT (seller_id) DO NOTHING
    RETURNING seller_id INTO v_strike_seller;

    IF v_strike_seller IS NOT NULL THEN
      UPDATE public.shipengine_label_adjustments
      SET
        coverage = 'covered_strike',
        earnings_deducted_usd = 0
      WHERE id = r_adjustment.id;
      v_covered := v_covered + 1;
      CONTINUE;
    END IF;

    v_amount := round(r_adjustment.adjustment_amount_usd::numeric, 2);
    v_deduct := round(LEAST(v_amount, GREATEST(COALESCE(r_order.seller_earnings, 0), 0))::numeric, 2);

    SELECT *
    INTO r_wallet
    FROM public.wallets
    WHERE user_id = r_order.seller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.wallets (user_id)
      VALUES (r_order.seller_id)
      RETURNING * INTO r_wallet;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.wallet_transactions wt
      WHERE wt.reference_type = 'order_seller_earnings'
        AND wt.reference_id = r_order.id::text
    )
    INTO v_released;

    IF v_released THEN
      v_take := round(
        LEAST(v_deduct, GREATEST(COALESCE(r_wallet.balance, 0), 0))::numeric,
        2
      );
      v_balance_after := round(COALESCE(r_wallet.balance, 0)::numeric - v_take, 2);
    ELSE
      v_take := round(
        LEAST(v_deduct, GREATEST(COALESCE(r_wallet.pending_balance, 0), 0))::numeric,
        2
      );
      v_balance_after := round(COALESCE(r_wallet.balance, 0)::numeric, 2);
    END IF;

    -- Skip the wallet write when nothing can be collected. Rewriting a balance that
    -- is already below the positive_balance check would fail the row constraint.
    IF v_take > 0 THEN
      IF v_released THEN
        UPDATE public.wallets
        SET
          balance = v_balance_after,
          lifetime_earned = round(GREATEST(COALESCE(lifetime_earned, 0)::numeric - v_take, 0), 2),
          updated_at = now()
        WHERE id = r_wallet.id;
      ELSE
        UPDATE public.wallets
        SET
          pending_balance = round(GREATEST(COALESCE(pending_balance, 0)::numeric - v_take, 0), 2),
          lifetime_earned = round(GREATEST(COALESCE(lifetime_earned, 0)::numeric - v_take, 0), 2),
          updated_at = now()
        WHERE id = r_wallet.id;
      END IF;

      v_amount_label := trim(to_char(v_take, 'FM999999990.00'));
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
          'Adjustment fee — $%s was deducted from your earnings on order %s. The carrier measured the packed package at %s. The next shipment has to stay within the label size.',
          v_amount_label,
          v_order_label,
          v_dimensions
        );
      ELSE
        v_description := format(
          'Adjustment fee — $%s was deducted from your earnings on order %s. The carrier billed this because the packed package was larger or heavier than the label.',
          v_amount_label,
          v_order_label
        );
      END IF;

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
        r_order.seller_id,
        'purchase',
        -v_take,
        v_balance_after,
        left(v_description, 500),
        'completed',
        r_adjustment.debit_reference_id,
        'shipengine_label_adjustment'
      )
      RETURNING id INTO v_transaction_id;
    END IF;

    UPDATE public.shipengine_label_adjustments
    SET
      coverage = 'charged_to_earnings',
      earnings_deducted_usd = v_deduct,
      wallet_transaction_id = v_transaction_id,
      wallet_debited_at = now()
    WHERE id = r_adjustment.id;

    v_charged := v_charged + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'charged', v_charged,
    'covered', v_covered,
    'already_charged', v_already_charged
  );
END;
$$;

COMMENT ON FUNCTION public.apply_shipengine_label_adjustment_debits(integer) IS
  'Covers a seller''s first carrier adjustment. Later adjustments are deducted from that sale''s earnings without driving wallet balance negative.';

-- Apply the strike to chargeable rows that are still open.
SELECT public.apply_shipengine_label_adjustment_debits(500);

CREATE OR REPLACE FUNCTION public.get_my_seller_earnings_totals()
RETURNS TABLE (
  lifetime_sold_usd numeric,
  earned_last_30d_usd numeric,
  earned_last_90d_usd numeric,
  earned_last_365d_usd numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH nets AS (
    SELECT
      o.created_at,
      GREATEST(
        0::numeric,
        COALESCE(o.seller_earnings, 0)::numeric - COALESCE((
          SELECT SUM(a.earnings_deducted_usd)
          FROM public.shipengine_label_adjustments a
          WHERE a.order_id = o.id
            AND a.coverage = 'charged_to_earnings'
            AND COALESCE(a.earnings_deducted_usd, 0) > 0
        ), 0)
      ) AS net_earnings
    FROM public.orders o
    WHERE o.seller_id = auth.uid()
      AND o.is_admin_test = false
      AND o.status IS DISTINCT FROM 'refunded'
  )
  SELECT
    COALESCE(ROUND((SELECT SUM(net_earnings) FROM nets), 2), 0)::numeric,
    COALESCE(ROUND((SELECT SUM(net_earnings) FROM nets WHERE created_at >= now() - interval '30 days'), 2), 0)::numeric,
    COALESCE(ROUND((SELECT SUM(net_earnings) FROM nets WHERE created_at >= now() - interval '90 days'), 2), 0)::numeric,
    COALESCE(ROUND((SELECT SUM(net_earnings) FROM nets WHERE created_at >= now() - interval '365 days'), 2), 0)::numeric;
$$;

COMMENT ON FUNCTION public.get_my_seller_earnings_totals() IS
  'Dashboard: sums orders.seller_earnings minus carrier adjustments deducted from those sales. Excludes admin test orders and status=refunded.';
