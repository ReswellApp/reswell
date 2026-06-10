-- Manual admin opt-out from Google Merchant Center feed (listing stays live on Reswell).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS excluded_from_google_merchant boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.excluded_from_google_merchant IS
  'When true, listing is omitted from Google Merchant sync even if otherwise eligible (active surfboard with image).';

CREATE INDEX IF NOT EXISTS listings_excluded_from_google_merchant_idx
  ON public.listings (excluded_from_google_merchant)
  WHERE excluded_from_google_merchant = true;
