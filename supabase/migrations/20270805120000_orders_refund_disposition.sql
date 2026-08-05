-- Persist admin/system intent for post-refund listing + messaging side effects.
-- Needed when Stripe refunds complete asynchronously via webhook after admin starts a refund.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_disposition text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_refund_disposition_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_refund_disposition_check
  CHECK (
    refund_disposition IS NULL
    OR refund_disposition IN (
      'exclusive_relist',
      'vacation_hold',
      'cancel_unshipped',
      'public_relist'
    )
  );

COMMENT ON COLUMN public.orders.refund_disposition IS
  'Post-refund listing/messaging plan: exclusive_relist (buyer repurchase window), vacation_hold (active + vacation), cancel_unshipped (void unused label + vacation), public_relist (live for everyone, no exclusive). NULL treated as exclusive_relist.';
