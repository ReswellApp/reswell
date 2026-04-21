-- Guest / sessionless card checkout was removed from the app: every marketplace order
-- has an authenticated buyer. This migration normalizes `public.orders` back to the
-- member-only shape, regardless of whether `20260420140000_orders_guest_buyer_nullable`
-- was ever applied on this environment.

ALTER TABLE public.orders DROP COLUMN IF EXISTS guest_buyer_email;

-- Refuse to tighten NOT NULL if orphan guest rows somehow exist: they'd need manual review.
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT count(*)::int INTO orphan_count FROM public.orders WHERE buyer_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Cannot set orders.buyer_id NOT NULL: % row(s) have buyer_id IS NULL. Reassign or delete them first.',
      orphan_count;
  END IF;
END $$;

ALTER TABLE public.orders ALTER COLUMN buyer_id SET NOT NULL;

COMMENT ON COLUMN public.orders.buyer_id IS
  'Buyer auth user id. Marketplace orders always have an authenticated buyer.';
