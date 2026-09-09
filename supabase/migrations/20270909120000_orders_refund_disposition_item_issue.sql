-- Wrong-item / returned-goods refund plan (full item amount + vacation hold).
-- Return labels stay on the Item returns panel — this only records listing side effects.

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
      'public_relist'
    )
  );

COMMENT ON COLUMN public.orders.refund_disposition IS
  'Post-refund listing/messaging plan: exclusive_relist (buyer repurchase window), item_issue (wrong/returned item, vacation hold), vacation_hold (active + vacation), cancel_unshipped (void unused label + vacation), public_relist (live for everyone, no exclusive). NULL treated as exclusive_relist.';
