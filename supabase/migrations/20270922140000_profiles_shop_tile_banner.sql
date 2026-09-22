-- Directory tile image on /sellers. Independent of shop_banner_url (profile header).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_tile_banner_url text,
  ADD COLUMN IF NOT EXISTS shop_tile_banner_focal_x_pct numeric(5, 2),
  ADD COLUMN IF NOT EXISTS shop_tile_banner_focal_y_pct numeric(5, 2);

COMMENT ON COLUMN public.profiles.shop_tile_banner_url IS
  'Image for the seller directory tile. Not the public profile header banner.';
COMMENT ON COLUMN public.profiles.shop_tile_banner_focal_x_pct IS
  'Horizontal focal point for the directory tile banner (0=left, 50=center, 100=right).';
COMMENT ON COLUMN public.profiles.shop_tile_banner_focal_y_pct IS
  'Vertical focal point for the directory tile banner (0=top, 50=center, 100=bottom).';
