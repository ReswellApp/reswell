-- Optional attributes for used accessory listings (e.g. fins) — powers category-specific filters
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS gear_size TEXT,
  ADD COLUMN IF NOT EXISTS gear_color TEXT;

COMMENT ON COLUMN public.listings.gear_size IS 'Optional size label for used accessories (e.g. fin system size)';
COMMENT ON COLUMN public.listings.gear_color IS 'Optional color label for used accessories';
