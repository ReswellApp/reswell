-- Persist seller-entered packed box + weight for Reswell-calculated (ShipEngine) checkout.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS shipping_packed_length_in numeric(6, 2),
  ADD COLUMN IF NOT EXISTS shipping_packed_width_in numeric(6, 2),
  ADD COLUMN IF NOT EXISTS shipping_packed_height_in numeric(6, 2),
  ADD COLUMN IF NOT EXISTS shipping_packed_weight_oz numeric(8, 2);

COMMENT ON COLUMN public.listings.shipping_packed_length_in IS
  'Surfboards / Reswell shipping: packed box length (in) for carrier rating.';
COMMENT ON COLUMN public.listings.shipping_packed_width_in IS
  'Surfboards / Reswell shipping: packed box width (in) for carrier rating.';
COMMENT ON COLUMN public.listings.shipping_packed_height_in IS
  'Surfboards / Reswell shipping: packed box height (in) for carrier rating.';
COMMENT ON COLUMN public.listings.shipping_packed_weight_oz IS
  'Surfboards / Reswell shipping: total packed weight in ounces for carrier rating.';
