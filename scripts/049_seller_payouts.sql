-- Seller Payout System — Stripe Connect
-- Adds: seller_stripe_accounts, seller_balances, payouts, seller_payment_methods

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE stripe_account_status_enum AS ENUM (
    'PENDING',
    'ACTIVE',
    'RESTRICTED',
    'DISABLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_method_enum AS ENUM (
    'ACH',
    'INSTANT',
    'PAYPAL',
    'RESWELL_CREDIT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_status_enum AS ENUM (
    'PENDING',
    'IN_TRANSIT',
    'PAID',
    'FAILED',
    'CANCELED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type_enum AS ENUM (
    'BANK_ACCOUNT',
    'DEBIT_CARD',
    'PAYPAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- seller_stripe_accounts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seller_stripe_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id   text NOT NULL UNIQUE,
  account_status      stripe_account_status_enum NOT NULL DEFAULT 'PENDING',
  payouts_enabled     boolean NOT NULL DEFAULT false,
  charges_enabled     boolean NOT NULL DEFAULT false,
  details_submitted   boolean NOT NULL DEFAULT false,
  country             text NOT NULL DEFAULT 'US',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS seller_stripe_accounts_user_id_idx
  ON seller_stripe_accounts(user_id);

ALTER TABLE seller_stripe_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_stripe_accounts_select_own" ON seller_stripe_accounts;
CREATE POLICY "seller_stripe_accounts_select_own"
  ON seller_stripe_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "seller_stripe_accounts_insert_own" ON seller_stripe_accounts;
CREATE POLICY "seller_stripe_accounts_insert_own"
  ON seller_stripe_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "seller_stripe_accounts_update_own" ON seller_stripe_accounts;
CREATE POLICY "seller_stripe_accounts_update_own"
  ON seller_stripe_accounts FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- seller_balances
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seller_balances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance   numeric(12,2) NOT NULL DEFAULT 0,
  pending_balance     numeric(12,2) NOT NULL DEFAULT 0,
  reswell_credit      numeric(12,2) NOT NULL DEFAULT 0,
  lifetime_earned     numeric(12,2) NOT NULL DEFAULT 0,
  lifetime_paid_out   numeric(12,2) NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS seller_balances_user_id_idx
  ON seller_balances(user_id);

ALTER TABLE seller_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_balances_select_own" ON seller_balances;
CREATE POLICY "seller_balances_select_own"
  ON seller_balances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "seller_balances_insert_own" ON seller_balances;
CREATE POLICY "seller_balances_insert_own"
  ON seller_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "seller_balances_update_own" ON seller_balances;
CREATE POLICY "seller_balances_update_own"
  ON seller_balances FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- payouts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              numeric(12,2) NOT NULL,
  fee                 numeric(12,2) NOT NULL DEFAULT 0,
  net_amount          numeric(12,2) NOT NULL,
  method              payout_method_enum NOT NULL,
  status              payout_status_enum NOT NULL DEFAULT 'PENDING',
  stripe_payout_id    text,
  stripe_transfer_id  text,
  destination         text,
  estimated_arrival   timestamptz,
  failure_reason      text,
  ip_address          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payouts_user_id_created_at_idx
  ON payouts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payouts_stripe_payout_id_idx
  ON payouts(stripe_payout_id) WHERE stripe_payout_id IS NOT NULL;

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payouts_select_own" ON payouts;
CREATE POLICY "payouts_select_own"
  ON payouts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "payouts_insert_own" ON payouts;
CREATE POLICY "payouts_insert_own"
  ON payouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payouts_update_own" ON payouts;
CREATE POLICY "payouts_update_own"
  ON payouts FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- seller_payment_methods
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seller_payment_methods (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              payment_method_type_enum NOT NULL,
  is_default        boolean NOT NULL DEFAULT false,

  -- Bank account fields
  bank_name         text,
  account_last4     text,
  routing_last4     text,

  -- Debit card fields
  card_brand        text,
  card_last4        text,
  card_exp          text,

  -- PayPal fields
  paypal_email      text,

  stripe_pm_id      text,
  verified          boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_payment_methods_user_id_idx
  ON seller_payment_methods(user_id);

ALTER TABLE seller_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_payment_methods_select_own" ON seller_payment_methods;
CREATE POLICY "seller_payment_methods_select_own"
  ON seller_payment_methods FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "seller_payment_methods_insert_own" ON seller_payment_methods;
CREATE POLICY "seller_payment_methods_insert_own"
  ON seller_payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "seller_payment_methods_update_own" ON seller_payment_methods;
CREATE POLICY "seller_payment_methods_update_own"
  ON seller_payment_methods FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "seller_payment_methods_delete_own" ON seller_payment_methods;
CREATE POLICY "seller_payment_methods_delete_own"
  ON seller_payment_methods FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- payout_security_log  (fraud / audit trail)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payout_security_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,   -- 'payout_requested', 'method_added', 'method_removed', etc.
  details     jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payout_security_log_user_id_idx
  ON payout_security_log(user_id, created_at DESC);

ALTER TABLE payout_security_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_security_log_select_own" ON payout_security_log;
CREATE POLICY "payout_security_log_select_own"
  ON payout_security_log FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: ensure seller_balances row exists for user
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ensure_seller_balance(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO seller_balances (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
