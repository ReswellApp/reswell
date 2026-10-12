-- Shop default shipping package and board-length packed-size assignments.
-- Edited from Advanced on /dashboard/listings.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_shipping_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.shop_shipping_defaults IS
  'Seller shop default package (inches and pounds) plus board-length assignments to saved packed sizes.';
