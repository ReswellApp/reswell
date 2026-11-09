-- Reswell Credit: non-cashable loyalty store credit (separate from Reswell Bucks / wallets).
-- Admin pilot only at the app layer; ledger itself is usable for any user_id.

CREATE TABLE IF NOT EXISTS public.reswell_credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  lifetime_earned_cents bigint NOT NULL DEFAULT 0 CHECK (lifetime_earned_cents >= 0),
  lifetime_spent_cents bigint NOT NULL DEFAULT 0 CHECK (lifetime_spent_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reswell_credit_wallets IS
  'Reswell Credit balances. Never cashable. Distinct from public.wallets (Reswell Bucks).';

CREATE TABLE IF NOT EXISTS public.reswell_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.reswell_credit_wallets (id),
  user_id uuid NOT NULL REFERENCES auth.users (id),
  type text NOT NULL CHECK (type IN ('earn', 'spend_hold', 'spend', 'release', 'clawback', 'grant')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  balance_after_cents bigint NOT NULL CHECK (balance_after_cents >= 0),
  description text NOT NULL,
  reference_type text,
  reference_id text,
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('posted', 'held', 'released', 'finalized')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reswell_credit_tx_reference_uidx UNIQUE (reference_type, reference_id, type)
);

CREATE INDEX IF NOT EXISTS reswell_credit_tx_wallet_created_idx
  ON public.reswell_credit_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reswell_credit_tx_user_created_idx
  ON public.reswell_credit_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reswell_credit_tx_hold_pi_idx
  ON public.reswell_credit_transactions (reference_id)
  WHERE reference_type = 'payment_intent' AND type = 'spend_hold';

COMMENT ON TABLE public.reswell_credit_transactions IS
  'Immutable Reswell Credit ledger rows. Holds are released or finalized; never cashed out.';

ALTER TABLE public.reswell_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reswell_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reswell_credit_wallets_select_own ON public.reswell_credit_wallets;
CREATE POLICY reswell_credit_wallets_select_own
  ON public.reswell_credit_wallets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS reswell_credit_tx_select_own ON public.reswell_credit_transactions;
CREATE POLICY reswell_credit_tx_select_own
  ON public.reswell_credit_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_or_create_reswell_credit_wallet(p_user_id uuid)
RETURNS public.reswell_credit_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.reswell_credit_wallets;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_required';
  END IF;

  SELECT * INTO w FROM public.reswell_credit_wallets WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN w;
  END IF;

  INSERT INTO public.reswell_credit_wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO w;

  RETURN w;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_reswell_credit(
  p_user_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_reference_type text,
  p_reference_id text,
  p_type text DEFAULT 'earn'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.reswell_credit_wallets;
  existing public.reswell_credit_transactions;
  tx public.reswell_credit_transactions;
  v_type text := COALESCE(NULLIF(trim(p_type), ''), 'earn');
BEGIN
  IF p_user_id IS NULL OR p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_award';
  END IF;
  IF v_type NOT IN ('earn', 'grant') THEN
    RAISE EXCEPTION 'invalid_award_type';
  END IF;
  IF p_reference_type IS NULL OR p_reference_id IS NULL THEN
    RAISE EXCEPTION 'reference_required';
  END IF;

  -- Admin pilot: never credit non-admin accounts (DB hard gate).
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.is_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT * INTO existing
  FROM public.reswell_credit_transactions
  WHERE reference_type = p_reference_type
    AND reference_id = p_reference_id
    AND type = v_type;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'replayed', true,
      'transaction_id', existing.id,
      'balance_cents', existing.balance_after_cents,
      'amount_cents', existing.amount_cents
    );
  END IF;

  w := public.get_or_create_reswell_credit_wallet(p_user_id);

  UPDATE public.reswell_credit_wallets
  SET
    balance_cents = balance_cents + p_amount_cents,
    lifetime_earned_cents = lifetime_earned_cents + p_amount_cents,
    updated_at = now()
  WHERE id = w.id
  RETURNING * INTO w;

  INSERT INTO public.reswell_credit_transactions (
    wallet_id, user_id, type, amount_cents, balance_after_cents,
    description, reference_type, reference_id, status
  )
  VALUES (
    w.id, p_user_id, v_type, p_amount_cents, w.balance_cents,
    COALESCE(NULLIF(trim(p_description), ''), 'Reswell Credit'),
    p_reference_type, p_reference_id, 'posted'
  )
  RETURNING * INTO tx;

  RETURN jsonb_build_object(
    'ok', true,
    'replayed', false,
    'transaction_id', tx.id,
    'balance_cents', w.balance_cents,
    'amount_cents', p_amount_cents
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO existing
    FROM public.reswell_credit_transactions
    WHERE reference_type = p_reference_type
      AND reference_id = p_reference_id
      AND type = v_type;
    RETURN jsonb_build_object(
      'ok', true,
      'replayed', true,
      'transaction_id', existing.id,
      'balance_cents', existing.balance_after_cents,
      'amount_cents', existing.amount_cents
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.hold_reswell_credit_for_payment_intent(
  p_user_id uuid,
  p_amount_cents bigint,
  p_payment_intent_id text,
  p_description text DEFAULT 'Reswell Credit applied at checkout'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.reswell_credit_wallets;
  existing public.reswell_credit_transactions;
  tx public.reswell_credit_transactions;
BEGIN
  IF p_user_id IS NULL OR p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_hold';
  END IF;
  IF p_payment_intent_id IS NULL OR length(trim(p_payment_intent_id)) = 0 THEN
    RAISE EXCEPTION 'payment_intent_required';
  END IF;

  -- Admin pilot: only admins may spend Reswell Credit.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.is_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT * INTO existing
  FROM public.reswell_credit_transactions
  WHERE reference_type = 'payment_intent'
    AND reference_id = p_payment_intent_id
    AND type = 'spend_hold';
  IF FOUND THEN
    IF existing.status = 'released' THEN
      RAISE EXCEPTION 'hold_already_released';
    END IF;
    IF existing.amount_cents <> p_amount_cents THEN
      RAISE EXCEPTION 'hold_amount_mismatch';
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'replayed', true,
      'transaction_id', existing.id,
      'balance_cents', existing.balance_after_cents,
      'amount_cents', existing.amount_cents,
      'status', existing.status
    );
  END IF;

  w := public.get_or_create_reswell_credit_wallet(p_user_id);

  IF w.balance_cents < p_amount_cents THEN
    RAISE EXCEPTION 'insufficient_credit:%', w.balance_cents;
  END IF;

  UPDATE public.reswell_credit_wallets
  SET
    balance_cents = balance_cents - p_amount_cents,
    updated_at = now()
  WHERE id = w.id AND balance_cents >= p_amount_cents
  RETURNING * INTO w;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credit';
  END IF;

  INSERT INTO public.reswell_credit_transactions (
    wallet_id, user_id, type, amount_cents, balance_after_cents,
    description, reference_type, reference_id, status
  )
  VALUES (
    w.id, p_user_id, 'spend_hold', p_amount_cents, w.balance_cents,
    COALESCE(NULLIF(trim(p_description), ''), 'Reswell Credit applied at checkout'),
    'payment_intent', p_payment_intent_id, 'held'
  )
  RETURNING * INTO tx;

  RETURN jsonb_build_object(
    'ok', true,
    'replayed', false,
    'transaction_id', tx.id,
    'balance_cents', w.balance_cents,
    'amount_cents', p_amount_cents,
    'status', 'held'
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO existing
    FROM public.reswell_credit_transactions
    WHERE reference_type = 'payment_intent'
      AND reference_id = p_payment_intent_id
      AND type = 'spend_hold';
    RETURN jsonb_build_object(
      'ok', true,
      'replayed', true,
      'transaction_id', existing.id,
      'balance_cents', existing.balance_after_cents,
      'amount_cents', existing.amount_cents,
      'status', existing.status
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_reswell_credit_hold(
  p_payment_intent_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hold_tx public.reswell_credit_transactions;
  w public.reswell_credit_wallets;
  release_tx public.reswell_credit_transactions;
BEGIN
  IF p_payment_intent_id IS NULL OR length(trim(p_payment_intent_id)) = 0 THEN
    RAISE EXCEPTION 'payment_intent_required';
  END IF;

  SELECT * INTO hold_tx
  FROM public.reswell_credit_transactions
  WHERE reference_type = 'payment_intent'
    AND reference_id = p_payment_intent_id
    AND type = 'spend_hold'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  IF hold_tx.status = 'released' THEN
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'status', 'released');
  END IF;

  IF hold_tx.status = 'finalized' THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'status', 'finalized');
  END IF;

  UPDATE public.reswell_credit_wallets
  SET
    balance_cents = balance_cents + hold_tx.amount_cents,
    updated_at = now()
  WHERE id = hold_tx.wallet_id
  RETURNING * INTO w;

  UPDATE public.reswell_credit_transactions
  SET status = 'released'
  WHERE id = hold_tx.id;

  INSERT INTO public.reswell_credit_transactions (
    wallet_id, user_id, type, amount_cents, balance_after_cents,
    description, reference_type, reference_id, status
  )
  VALUES (
    hold_tx.wallet_id, hold_tx.user_id, 'release', hold_tx.amount_cents, w.balance_cents,
    'Released Reswell Credit hold',
    'payment_intent_release', p_payment_intent_id, 'posted'
  )
  ON CONFLICT (reference_type, reference_id, type) DO NOTHING
  RETURNING * INTO release_tx;

  RETURN jsonb_build_object(
    'ok', true,
    'released', true,
    'amount_cents', hold_tx.amount_cents,
    'balance_cents', w.balance_cents
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_reswell_credit_hold(
  p_payment_intent_id text,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hold_tx public.reswell_credit_transactions;
  w public.reswell_credit_wallets;
  spend_tx public.reswell_credit_transactions;
BEGIN
  IF p_payment_intent_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'finalize_args_required';
  END IF;

  SELECT * INTO hold_tx
  FROM public.reswell_credit_transactions
  WHERE reference_type = 'payment_intent'
    AND reference_id = p_payment_intent_id
    AND type = 'spend_hold'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hold_not_found';
  END IF;

  IF hold_tx.status = 'finalized' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'replayed', true,
      'amount_cents', hold_tx.amount_cents
    );
  END IF;

  IF hold_tx.status = 'released' THEN
    RAISE EXCEPTION 'hold_already_released';
  END IF;

  SELECT * INTO w FROM public.reswell_credit_wallets WHERE id = hold_tx.wallet_id FOR UPDATE;

  UPDATE public.reswell_credit_wallets
  SET
    lifetime_spent_cents = lifetime_spent_cents + hold_tx.amount_cents,
    updated_at = now()
  WHERE id = hold_tx.wallet_id
  RETURNING * INTO w;

  UPDATE public.reswell_credit_transactions
  SET status = 'finalized'
  WHERE id = hold_tx.id;

  INSERT INTO public.reswell_credit_transactions (
    wallet_id, user_id, type, amount_cents, balance_after_cents,
    description, reference_type, reference_id, status
  )
  VALUES (
    hold_tx.wallet_id, hold_tx.user_id, 'spend', hold_tx.amount_cents, w.balance_cents,
    'Spent Reswell Credit on order',
    'order', p_order_id::text, 'posted'
  )
  ON CONFLICT (reference_type, reference_id, type) DO NOTHING
  RETURNING * INTO spend_tx;

  RETURN jsonb_build_object(
    'ok', true,
    'replayed', false,
    'amount_cents', hold_tx.amount_cents,
    'balance_cents', w.balance_cents,
    'spend_transaction_id', spend_tx.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_reswell_credit_wallet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_reswell_credit(uuid, bigint, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hold_reswell_credit_for_payment_intent(uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_reswell_credit_hold(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_reswell_credit_hold(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_or_create_reswell_credit_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_reswell_credit(uuid, bigint, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hold_reswell_credit_for_payment_intent(uuid, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_reswell_credit_hold(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_reswell_credit_hold(text, uuid) TO service_role;
