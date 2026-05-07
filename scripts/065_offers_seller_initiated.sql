-- Seller-initiated offers (e.g. seller proposes a price after a favorite notification).
-- Buyer sees status as “from seller”; stored row uses negotiation semantics compatible with counteroffer accept/decline.

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS seller_initiated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.offers.seller_initiated IS
  'True when the seller opened this negotiation (proactive offer). False when the buyer submitted the first offer.';
