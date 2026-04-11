-- Seller preferences for automated price drops and buyer offers (sell flow UI).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS auto_price_drop_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS buyer_offers_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.listings.auto_price_drop_enabled IS 'Seller opted in to a scheduled price reduction if the listing is still unsold.';
COMMENT ON COLUMN public.listings.buyer_offers_enabled IS 'Seller allows buyers to make purchase offers / negotiate.';
