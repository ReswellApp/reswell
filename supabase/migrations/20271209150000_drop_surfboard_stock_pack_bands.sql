-- Stock compact / medium / midlength / longboard cartons are no longer a
-- product package. Surfboards quote the seller or shop packed L×W×H instead.

update public.listings
set shipping_package_band = null
where shipping_package_band is not null;

alter table public.listings
  drop constraint if exists listings_shipping_package_band_check;

alter table public.listings
  add constraint listings_shipping_package_band_check
  check (shipping_package_band is null);

comment on column public.listings.shipping_package_band is
  'Unused. Stock shortboard pack bands were removed; packed L×W×H is the carton.';

comment on constraint listings_shipping_package_band_check on public.listings is
  'Pack-band carton identity is retired. New writes leave this column null.';
