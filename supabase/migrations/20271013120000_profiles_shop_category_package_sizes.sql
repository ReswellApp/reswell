-- Seller defaults for the packed box used by each marketplace category.
-- Edited from Advanced on /dashboard/listings and applied to that seller's open listings.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_category_package_sizes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.shop_category_package_sizes IS
  'Shop package-size preset per listing section (surfboards, fins, wetsuits, …). Keys are peer sections; values are shop package size ids.';
