-- Stripe Connect: Express account id + non-sensitive payout hints for sellers who cash out via ACH.
-- Full bank details live only at Stripe; we store Stripe ids and optional last4 / bank name for UX.

CREATE TABLE IF NOT EXISTS public.stripe_connect_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  default_external_account_id text,
  bank_last4 text,
  bank_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_connect_accounts_stripe_id_idx
  ON public.stripe_connect_accounts (stripe_account_id);

ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_connect_accounts_select_own" ON public.stripe_connect_accounts;
CREATE POLICY "stripe_connect_accounts_select_own"
  ON public.stripe_connect_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "stripe_connect_accounts_insert_own" ON public.stripe_connect_accounts;
CREATE POLICY "stripe_connect_accounts_insert_own"
  ON public.stripe_connect_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stripe_connect_accounts_update_own" ON public.stripe_connect_accounts;
CREATE POLICY "stripe_connect_accounts_update_own"
  ON public.stripe_connect_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.stripe_connect_accounts IS
  'Stripe Connect Express account per seller; bank identifiers are Stripe-side — we only mirror status + optional last4 for UI.';

CREATE TABLE IF NOT EXISTS public.stripe_connect_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  stripe_transfer_id text UNIQUE,
  status text NOT NULL DEFAULT 'PROCESSING'
    CHECK (
      status IN (
        'PROCESSING',
        'SUCCEEDED',
        'FAILED',
        'REVERSED'
      )
    ),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_connect_transfers_user_created_idx
  ON public.stripe_connect_transfers (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stripe_connect_transfers_stripe_id_idx
  ON public.stripe_connect_transfers (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

ALTER TABLE public.stripe_connect_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_connect_transfers_select_own" ON public.stripe_connect_transfers;
CREATE POLICY "stripe_connect_transfers_select_own"
  ON public.stripe_connect_transfers
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "stripe_connect_transfers_insert_own" ON public.stripe_connect_transfers;
CREATE POLICY "stripe_connect_transfers_insert_own"
  ON public.stripe_connect_transfers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.stripe_connect_transfers IS
  'Platform → Connect balance transfers funding seller ACH; reversed via Stripe webhook refunds wallet.';
