-- Add Backpacks as a used gear category
-- Run in Supabase SQL Editor

INSERT INTO public.categories (id, name, slug, description, board, gear) VALUES
  ('a6000006-0000-4000-8000-000000000006', 'Backpacks', 'backpacks', 'Surf and gear backpacks', FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;
