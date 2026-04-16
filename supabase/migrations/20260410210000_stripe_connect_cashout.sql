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
  fee_amount numeric(12, 2) NOT NULL DEFAULT 0,
  payout_speed text NOT NULL DEFAULT 'standard'
    CONSTRAINT stripe_connect_transfers_payout_speed_chk
      CHECK (payout_speed IN ('standard', 'instant')),
  stripe_transfer_id text UNIQUE,
  stripe_payout_id text,
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

-- Existing databases may already have stripe_connect_transfers without these columns; CREATE TABLE IF NOT EXISTS
-- does not add them. Ensure columns + check exist before indexes reference stripe_payout_id.
ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS payout_speed text NOT NULL DEFAULT 'standard';

ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS stripe_payout_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_connect_transfers_payout_speed_chk'
  ) THEN
    ALTER TABLE public.stripe_connect_transfers
      ADD CONSTRAINT stripe_connect_transfers_payout_speed_chk
      CHECK (payout_speed IN ('standard', 'instant'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stripe_connect_transfers_user_created_idx
  ON public.stripe_connect_transfers (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stripe_connect_transfers_stripe_id_idx
  ON public.stripe_connect_transfers (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stripe_connect_transfers_stripe_payout_id_idx
  ON public.stripe_connect_transfers (stripe_payout_id)
  WHERE stripe_payout_id IS NOT NULL;

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

COMMENT ON COLUMN public.stripe_connect_transfers.fee_amount IS
  'Reswell platform fee (USD) included in the wallet debit for instant payouts; 0 for standard ACH.';
COMMENT ON COLUMN public.stripe_connect_transfers.payout_speed IS
  'standard: transfer only (Stripe schedules bank payout); instant: immediate payout to bank where supported.';
COMMENT ON COLUMN public.stripe_connect_transfers.stripe_payout_id IS
  'Connected-account payout id when payout_speed = instant (po_...).';
