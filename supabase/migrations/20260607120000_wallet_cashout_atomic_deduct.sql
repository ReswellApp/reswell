-- Atomic wallet debit before external cash-out (PayPal / Stripe Connect).
-- Prevents concurrent payout requests from each passing a read-check and sending real money once.

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
