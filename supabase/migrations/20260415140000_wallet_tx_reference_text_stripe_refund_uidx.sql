-- Stripe refund webhook stores PaymentIntent / Refund ids (e.g. re_…) in wallet_transactions.reference_id.
-- Existing rows may use uuid text; widen to plain text and enforce idempotency per Stripe refund id.

ALTER TABLE public.wallet_transactions
  ALTER COLUMN reference_id TYPE text USING reference_id::text;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_stripe_refund_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'stripe_refund';

COMMENT ON INDEX public.wallet_transactions_stripe_refund_uidx IS
  'Stripe refund webhooks: one wallet row per re_… so concurrent deliveries cannot double-clawback.';
