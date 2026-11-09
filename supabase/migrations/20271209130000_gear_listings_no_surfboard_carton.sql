-- Surfboard carton columns belong only on surfboard rows.
-- Mobile sell used the board persist helper with adminCustomShippingCarton,
-- which wrote shipping_package_tier = 'shortboard' onto fins and other gear.
-- Checkout then quoted the Medium board box (~$300 Ground) instead of the fin.

update public.listings
set
  shipping_package_tier = null,
  shipping_package_band = null
where section is distinct from 'surfboards'
  and (
    shipping_package_tier is not null
    or shipping_package_band is not null
  );

alter table public.listings
  drop constraint if exists listings_shipping_package_tier_section_check;

alter table public.listings
  add constraint listings_shipping_package_tier_section_check
  check (
    (
      shipping_package_tier is null
      and shipping_package_band is null
    )
    or section = 'surfboards'
  );

comment on constraint listings_shipping_package_tier_section_check on public.listings is
  'Shortboard / midlength / longboard cartons are surfboard-only. Gear stores packed L×W×H with null tier.';
