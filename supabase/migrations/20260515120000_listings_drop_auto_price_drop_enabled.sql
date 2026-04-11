-- Collapse price-drop settings into one column: NULL floor = off; NOT NULL = on at that minimum price.
-- buyer_offers_enabled stays separate (unrelated feature).

UPDATE public.listings
SET auto_price_drop_floor = NULL
WHERE COALESCE(auto_price_drop_enabled, FALSE) = FALSE;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS auto_price_drop_enabled;

COMMENT ON COLUMN public.listings.auto_price_drop_floor IS
  'Minimum list price after the scheduled 2-week drop; NULL means the seller did not enable auto price drop.';
