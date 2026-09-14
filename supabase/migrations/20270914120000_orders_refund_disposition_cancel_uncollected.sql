-- Local pickup never collected: full-order refund + vacation hold (no label void).

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_refund_disposition_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_refund_disposition_check
  CHECK (
    refund_disposition IS NULL
    OR refund_disposition IN (
      'exclusive_relist',
      'item_issue',
      'vacation_hold',
      'cancel_unshipped',
      'cancel_uncollected',
      'public_relist'
    )
  );

COMMENT ON COLUMN public.orders.refund_disposition IS
  'Post-refund listing/messaging plan: exclusive_relist (buyer repurchase window), item_issue (wrong/returned item, vacation hold), vacation_hold (active + vacation), cancel_unshipped (void unused label + vacation), cancel_uncollected (local pickup never happened, vacation), public_relist (live for everyone, no exclusive). NULL treated as exclusive_relist.';
