-- Repair: drop band check before rewriting values (same ordering fix as 20260806120000).
-- Safe to run if the prior migration failed mid-way or the app wrote shortboard_medium under the old constraint.

alter table public.listings
  drop constraint if exists listings_shipping_package_band_check;

update public.listings
set shipping_package_band = 'shortboard_medium'
where shipping_package_band in ('shortboard_standard', 'shortboard_max');

alter table public.listings
  drop constraint if exists listings_shipping_package_band_check;

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
