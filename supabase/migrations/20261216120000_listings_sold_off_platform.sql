-- Seller-reported off-platform sales (FB Marketplace, Craigslist, etc.).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sold_off_platform boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold_off_platform_channel text,
  ADD COLUMN IF NOT EXISTS sold_off_platform_detail text,
  ADD COLUMN IF NOT EXISTS sold_off_platform_at timestamptz;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_sold_off_platform_channel_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_sold_off_platform_channel_check
  CHECK (
    sold_off_platform_channel IS NULL
    OR sold_off_platform_channel IN ('fb_marketplace', 'craigslist', 'elsewhere')
  );

COMMENT ON COLUMN public.listings.sold_off_platform IS
  'True when the seller marked the listing sold outside Reswell.';
COMMENT ON COLUMN public.listings.sold_off_platform_channel IS
  'Off-platform sale channel: fb_marketplace, craigslist, or elsewhere.';
COMMENT ON COLUMN public.listings.sold_off_platform_detail IS
  'Freeform detail when sold_off_platform_channel is elsewhere.';
COMMENT ON COLUMN public.listings.sold_off_platform_at IS
  'When the seller reported the off-platform sale.';
