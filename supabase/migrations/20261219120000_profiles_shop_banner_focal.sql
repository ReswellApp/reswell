-- Shop banner crop / focal point (object-position percentages, 0–100).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_banner_focal_x_pct numeric(5, 2),
  ADD COLUMN IF NOT EXISTS shop_banner_focal_y_pct numeric(5, 2);

COMMENT ON COLUMN public.profiles.shop_banner_focal_x_pct IS
  'Horizontal focal point for shop banner object-position (0=left, 50=center, 100=right).';
COMMENT ON COLUMN public.profiles.shop_banner_focal_y_pct IS
  'Vertical focal point for shop banner object-position (0=top, 50=center, 100=bottom).';
