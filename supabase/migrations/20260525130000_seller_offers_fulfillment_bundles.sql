-- Seller-initiated offers: fulfillment choice, optional shipping amount, bundled line items.

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS fulfillment text,
  ADD COLUMN IF NOT EXISTS shipping_amount decimal(10, 2),
  ADD COLUMN IF NOT EXISTS line_items jsonb;

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_fulfillment_check;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_fulfillment_check
  CHECK (fulfillment IS NULL OR fulfillment IN ('pickup', 'shipping'));

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_shipping_amount_nonneg;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_shipping_amount_nonneg
  CHECK (shipping_amount IS NULL OR shipping_amount >= 0);

COMMENT ON COLUMN public.offers.fulfillment IS 'Seller-proposed fulfillment for seller-initiated offers (pickup | shipping).';
COMMENT ON COLUMN public.offers.shipping_amount IS 'Flat shipping amount proposed by seller (USD), when fulfillment = shipping.';
COMMENT ON COLUMN public.offers.line_items IS 'Bundled offer line items: [{ "listing_id", "amount", "title" }].';
