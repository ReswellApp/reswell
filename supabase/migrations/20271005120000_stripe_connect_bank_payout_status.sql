-- Deposit progress on the existing cash-out row. No new table.
-- `status` stays the wallet lifecycle (SUCCEEDED = funds reached the connected account).
-- `stripe_payout_id` already stores the po_ when we know it. These two columns are the
-- ACH fields that id does not carry: Stripe's payout status, and the expected deposit day.
-- A batched ACH repeats those two values on each cash-out it covers. That is cheaper than
-- a payout table and a join on every Earnings load.

ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS bank_payout_status text;

ALTER TABLE public.stripe_connect_transfers
  ADD COLUMN IF NOT EXISTS expected_arrival_at timestamptz;

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
  'Stripe payout.arrival_date (UTC midnight of the day the bank is expected to have the funds). When bank_payout_status is paid, this is the deposit day we show.';
