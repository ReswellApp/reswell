-- Atomic wallet debit for purchases: prevents race-condition double-spend.
-- A conditional UPDATE guarantees that concurrent requests cannot both pass the
-- balance check — Postgres row-level locking serializes the writes automatically.

CREATE OR REPLACE FUNCTION public.debit_wallet_for_purchase(
  p_user_id uuid,
  p_amount numeric
) RETURNS TABLE(wallet_id uuid, new_balance numeric, new_lifetime_spent numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_new_balance numeric;
  v_new_lifetime_spent numeric;
BEGIN
  UPDATE public.wallets w
  SET
    balance = w.balance - p_amount,
    lifetime_spent = w.lifetime_spent + p_amount,
    updated_at = now()
  WHERE w.user_id = p_user_id
    AND w.balance >= p_amount
  RETURNING w.id, w.balance, w.lifetime_spent
  INTO v_wallet_id, v_new_balance, v_new_lifetime_spent;

  IF v_wallet_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_lifetime_spent;
END;
$$;
