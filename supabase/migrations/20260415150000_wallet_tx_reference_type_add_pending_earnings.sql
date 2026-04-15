-- The wallet_transactions_reference_type_check constraint is missing values
-- used by the marketplace order flow (order_pending_earnings, order_seller_earnings)
-- and other payment paths. Replace it with the full set the app requires.

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_reference_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_reference_type_check
  CHECK (
    reference_type IN (
      'listing',
      'order_pending_earnings',
      'order_seller_earnings',
      'stripe_refund',
      'stripe_connect_transfer',
      'paypal_payout'
    )
  );
