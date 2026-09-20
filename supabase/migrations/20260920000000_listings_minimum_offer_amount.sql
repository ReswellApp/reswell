-- Add minimum_offer_amount column to listings table
-- Allows sellers to set a fixed dollar amount as the minimum acceptable offer
-- Takes precedence over minimum_offer_pct when set

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS minimum_offer_amount numeric(10,2);

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_minimum_offer_amount_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_minimum_offer_amount_check CHECK (
    minimum_offer_amount IS NULL OR minimum_offer_amount > 0
  );

COMMENT ON COLUMN public.listings.minimum_offer_amount IS
  'Fixed minimum dollar amount the seller will accept for an offer. When set, takes precedence over minimum_offer_pct. NULL means fall back to minimum_offer_pct.';
