-- After a refunded relist, the original buyer may have a short exclusive repurchase window.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS exclusive_buyer_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exclusive_buyer_until timestamptz;

COMMENT ON COLUMN public.listings.exclusive_buyer_id IS
  'When set with exclusive_buyer_until in the future, only this buyer may purchase the listing.';
COMMENT ON COLUMN public.listings.exclusive_buyer_until IS
  'Exclusive repurchase window end time for exclusive_buyer_id.';

CREATE INDEX IF NOT EXISTS listings_exclusive_buyer_until_idx
  ON public.listings (exclusive_buyer_until)
  WHERE exclusive_buyer_until IS NOT NULL;
