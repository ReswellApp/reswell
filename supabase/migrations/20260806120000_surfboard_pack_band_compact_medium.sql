-- Consolidate shortboard pack bands to Compact + Medium (drop Standard/Max).
-- Drop the old check first — UPDATE to shortboard_medium fails while standard/max are still the only "large" values allowed.

alter table public.listings
  drop constraint if exists listings_shipping_package_band_check;

update public.listings
set shipping_package_band = 'shortboard_medium'
where shipping_package_band in ('shortboard_standard', 'shortboard_max');

alter table public.listings
  add constraint listings_shipping_package_band_check
  check (
    shipping_package_band is null
    or shipping_package_band in (
      'shortboard_compact',
      'shortboard_medium'
    )
  );

comment on column public.listings.shipping_package_band is
  'Shortboard pack band carton for Reswell quoting/labels. Null with tier=shortboard means shortboard_medium.';
