-- Each marketplace section owns its carton. Leftover shortboard packed dims on
-- gear (78″ Medium box written by mobile/custom-carton persist) are replaced
-- with that section's default mailer. Surfboard tier/band stay surfboard-only.

update public.listings
set
  shipping_package_tier = null,
  shipping_package_band = null,
  shipping_packed_length_in = case section
    when 'fins' then 10
    when 'leashes' then 12
    when 'traction' then 12
    when 'magazines' then 12
    when 'accessories' then 12
    when 'apparel' then 18
    when 'wetsuits' then 18
    when 'boardbags' then 36
    when 'surfpacks' then 36
    else null
  end,
  shipping_packed_width_in = case section
    when 'fins' then 7
    when 'leashes' then 10
    when 'traction' then 10
    when 'magazines' then 10
    when 'accessories' then 10
    when 'apparel' then 14
    when 'wetsuits' then 14
    when 'boardbags' then 16
    when 'surfpacks' then 16
    else null
  end,
  shipping_packed_height_in = case section
    when 'fins' then 4
    when 'leashes' then 4
    when 'traction' then 4
    when 'magazines' then 4
    when 'accessories' then 4
    when 'apparel' then 6
    when 'wetsuits' then 6
    when 'boardbags' then 8
    when 'surfpacks' then 8
    else null
  end,
  shipping_packed_weight_oz = case section
    when 'fins' then 48
    when 'leashes' then 32
    when 'traction' then 32
    when 'magazines' then 32
    when 'accessories' then 32
    when 'apparel' then 48
    when 'wetsuits' then 48
    when 'boardbags' then 96
    when 'surfpacks' then 96
    else null
  end
where section is distinct from 'surfboards'
  and (
    shipping_package_tier is not null
    or shipping_package_band is not null
    or coalesce(shipping_packed_length_in, 0) > 48
  );

alter table public.listings
  drop constraint if exists listings_gear_packed_length_section_check;

alter table public.listings
  add constraint listings_gear_packed_length_section_check
  check (
    section = 'surfboards'
    or shipping_packed_length_in is null
    or (
      shipping_packed_length_in >= 4
      and shipping_packed_length_in <= 48
    )
  );

comment on constraint listings_gear_packed_length_section_check on public.listings is
  'Non-surfboard listings cannot store a board-length carton. Each gear section uses its own small-parcel box.';
