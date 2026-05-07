-- Listing-level offer constraints (was offer_settings).
-- minimum_offer_pct: 50–90, NULL = use app default (70%).
-- Drops legacy offer_settings after backfill.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS minimum_offer_pct integer;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_minimum_offer_pct_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_minimum_offer_pct_check CHECK (
    minimum_offer_pct IS NULL OR (
      minimum_offer_pct >= 50 AND minimum_offer_pct <= 90
    )
  );

COMMENT ON COLUMN public.listings.minimum_offer_pct IS
  'Minimum acceptable offer as % of list price (50–90). NULL = platform default (70%).';

DO $body$
BEGIN
  IF to_regclass('public.offer_settings') IS NOT NULL THEN
    UPDATE public.listings l
    SET minimum_offer_pct = os.minimum_offer_pct
    FROM public.offer_settings os
    WHERE os.listing_id = l.id
      AND os.minimum_offer_pct IS NOT NULL;

    UPDATE public.listings l
    SET buyer_offers_enabled = false
    FROM public.offer_settings os
    WHERE os.listing_id = l.id
      AND os.offers_enabled = false;

    DROP TRIGGER IF EXISTS offer_settings_set_updated_at ON public.offer_settings;
    DROP TABLE public.offer_settings CASCADE;
  END IF;
END
$body$;
