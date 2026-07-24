-- Shortboard pack band under shipping_package_tier = 'shortboard'
-- (compact / standard / max). Null on shortboard listings means Max (legacy).
alter table public.listings
  add column if not exists shipping_package_band text;

alter table public.listings
  drop constraint if exists listings_shipping_package_band_check;

alter table public.listings
  add constraint listings_shipping_package_band_check
  check (
    shipping_package_band is null
    or shipping_package_band in (
      'shortboard_compact',
      'shortboard_standard',
      'shortboard_max'
    )
  );

comment on column public.listings.shipping_package_band is
  'Shortboard pack band carton for Reswell quoting/labels. Null with tier=shortboard means shortboard_max.';
