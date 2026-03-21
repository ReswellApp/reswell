-- Collectible facets for Collectibles & Vintage — /used/collectibles-vintage filters & sell form
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS collectible_type TEXT,
  ADD COLUMN IF NOT EXISTS collectible_era TEXT,
  ADD COLUMN IF NOT EXISTS collectible_condition TEXT;

COMMENT ON COLUMN public.listings.collectible_type IS
  'Subcategory: vintage_surfboards | vintage_apparel | surf_art | media_magazines | vintage_gear | rare_archive';
COMMENT ON COLUMN public.listings.collectible_era IS
  'Decade era: 70s | 80s | 90s | 2000s';
COMMENT ON COLUMN public.listings.collectible_condition IS
  'Collectible condition: mint | good | restored | display_only';
