-- Add Traction Pads as a used gear category (slug distinct from the existing 'new' traction-pads)
-- Run in Supabase SQL Editor

INSERT INTO public.categories (id, name, slug, description, board, gear) VALUES
  ('a5000005-0000-4000-8000-000000000005', 'Traction Pads', 'traction-pads-used', 'Deck grips and traction pads', FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;
