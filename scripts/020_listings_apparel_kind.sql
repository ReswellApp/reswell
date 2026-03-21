-- Apparel sub-type for used Apparel & Lifestyle — /used/apparel-lifestyle filters
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS apparel_kind TEXT;

COMMENT ON COLUMN public.listings.apparel_kind IS
  'For apparel-lifestyle: shirt | boardshorts | bikini | jacket | changing_towel | towel';
