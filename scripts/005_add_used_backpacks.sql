-- Add Backpacks as a used gear category
-- Run in Supabase SQL Editor

INSERT INTO public.categories (id, name, slug, description, section) VALUES
  ('a6000006-0000-4000-8000-000000000006', 'Backpacks', 'backpacks', 'Surf and gear backpacks', 'used')
ON CONFLICT (slug) DO NOTHING;
