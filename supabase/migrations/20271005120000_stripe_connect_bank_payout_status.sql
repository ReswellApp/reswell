-- Bank-deposit progress for Stripe Connect cash-outs.
-- `status` stays the wallet/transfer lifecycle (PROCESSING → SUCCEEDED means funds left the
-- Reswell wallet and reached the connected account). Express accounts then pay that balance
-- out on Stripe's automatic schedule, often batching several cash-outs into one ACH.
-- These columns mirror that bank payout (po_…) so Earnings can leave "Processing" once
-- Stripe's expected deposit date has arrived.

ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS bank_payout_status text;

ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS expected_arrival_at timestamptz;

ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS bank_paid_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_connect_transfers_bank_payout_status_chk'
  ) THEN
    ALTER TABLE public.stripe_connect_transfers
      ADD CONSTRAINT stripe_connect_transfers_bank_payout_status_chk
      CHECK (
        bank_payout_status IS NULL
        OR bank_payout_status IN (
          'pending',
          'in_transit',
          'paid',
          'failed',
          'canceled'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.stripe_connect_transfers.bank_payout_status IS
  'Stripe payout status for the ACH/instant deposit to the seller bank. Null until a po_ is matched. paid means Stripe reached the expected arrival date, not a bank posting confirmation.';

COMMENT ON COLUMN public.stripe_connect_transfers.expected_arrival_at IS
  'Stripe payout.arrival_date (UTC midnight of the day the bank is expected to have the funds).';

COMMENT ON COLUMN public.stripe_connect_transfers.bank_paid_at IS
  'When we first observed bank_payout_status = paid. Kept stable if later events repeat.';
