-- Replaces the separate refund_clawback_deficit model with a single rule: in-wallet
-- `wallets.balance` may go negative to represent refund/reversal of funds already paid out.

ALTER TABLE public.wallets
  DROP COLUMN IF EXISTS refund_clawback_deficit;

-- Same as original release (pending -> balance) without any deficit siphon.
CREATE OR REPLACE FUNCTION public.release_order_seller_earnings_to_wallet(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_order public.orders%ROWTYPE;
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
  'Moves seller earnings from pending_balance to balance when fulfillment is complete; idempotent.';
