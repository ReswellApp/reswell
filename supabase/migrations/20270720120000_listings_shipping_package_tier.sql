-- Seller-selected Reswell surfboard shipping tier (shortboard / midlength / longboard).
alter table public.listings
  add column if not exists shipping_package_tier text;

alter table public.listings
  drop constraint if exists listings_shipping_package_tier_check;

alter table public.listings
  add constraint listings_shipping_package_tier_check
  check (
    shipping_package_tier is null
    or shipping_package_tier in ('shortboard', 'midlength', 'longboard')
  );

comment on column public.listings.shipping_package_tier is
  'Reswell surfboard shipping tier chosen on /sell when board_shipping_cost_mode = reswell.';
