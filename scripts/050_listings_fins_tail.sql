-- Add fins_setup and tail_shape columns to listings table for surfboard-specific attributes
alter table public.listings
  add column if not exists fins_setup text,
  add column if not exists tail_shape text;

-- Optional: add check constraints for known values
-- alter table public.listings
--   add constraint listings_fins_setup_check check (fins_setup is null or fins_setup in ('single', 'twin', 'thruster', 'quad', 'five', 'other')),
--   add constraint listings_tail_shape_check check (tail_shape is null or tail_shape in ('round', 'squash', 'square', 'pin', 'swallow', 'fish'));
