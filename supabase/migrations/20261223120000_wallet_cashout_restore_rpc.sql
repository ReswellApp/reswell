-- Ensure wallet restore / deduct RPCs exist in prod (required for failed PayPal + Stripe Connect cash-outs).
-- Idempotent: safe to run even when 20260402120000 / 20260607120000 were partially applied.

CREATE OR REPLACE FUNCTION public.refund_to_available_balance (
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
    lifetime_cashed_out = GREATEST(
      0::numeric,
      round(w.lifetime_cashed_out::numeric - round(p_amount::numeric, 2), 2)
    ),
    updated_at = now()
  WHERE w.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.refund_to_available_balance IS
  'Restores spendable wallet balance after a failed external cash-out (PayPal / Stripe Connect reversal).';

CREATE OR REPLACE FUNCTION public.deduct_wallet_for_cashout (
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
    lifetime_cashed_out = round(w.lifetime_cashed_out::numeric + v_amount, 2),
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
    'lifetime_cashed_out_after', r_wallet.lifetime_cashed_out
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_for_cashout IS
  'Atomically debits spendable wallet balance before an external payout. Returns NULL when balance is insufficient.';

REVOKE ALL ON FUNCTION public.refund_to_available_balance(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_wallet_for_cashout(uuid, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.refund_to_available_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_for_cashout(uuid, numeric) TO service_role;

GRANT EXECUTE ON FUNCTION public.refund_to_available_balance(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_for_cashout(uuid, numeric) TO authenticated;
