-- Add used gear categories: Travel & Storage, Apparel & Lifestyle, Collectibles & Vintage, Hardware & Accessories
-- Run in Supabase SQL Editor

INSERT INTO public.categories (id, name, slug, description, board, gear) VALUES
  ('a1000001-0000-4000-8000-000000000001', 'Travel & Storage', 'travel-storage', 'Board bags, travel covers, and storage', FALSE, TRUE),
  ('a2000002-0000-4000-8000-000000000002', 'Apparel & Lifestyle', 'apparel-lifestyle', 'Surf apparel and lifestyle gear', FALSE, TRUE),
  ('a3000003-0000-4000-8000-000000000003', 'Collectibles & Vintage', 'collectibles-vintage', 'Vintage and collectible surf items', FALSE, TRUE),
  ('a4000004-0000-4000-8000-000000000004', 'Hardware & Accessories', 'hardware-accessories', 'Hardware and accessories', FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;
