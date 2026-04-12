-- Optional seller-only field: what the seller paid for the item (not exposed on public listing pages).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS seller_purchase_price_usd numeric(12, 2);

COMMENT ON COLUMN public.listings.seller_purchase_price_usd IS
  'Optional cost basis for the seller; stored for their records, not shown to buyers.';
