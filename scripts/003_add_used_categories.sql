-- Add used gear categories: Travel & Storage, Apparel & Lifestyle, Collectibles & Vintage, Hardware & Accessories
-- Run in Supabase SQL Editor

INSERT INTO public.categories (id, name, slug, description, section) VALUES
  ('a1000001-0000-4000-8000-000000000001', 'Travel & Storage', 'travel-storage', 'Board bags, travel covers, and storage', 'used'),
  ('a2000002-0000-4000-8000-000000000002', 'Apparel & Lifestyle', 'apparel-lifestyle', 'Surf apparel and lifestyle gear', 'used'),
  ('a3000003-0000-4000-8000-000000000003', 'Collectibles & Vintage', 'collectibles-vintage', 'Vintage and collectible surf items', 'used'),
  ('a4000004-0000-4000-8000-000000000004', 'Hardware & Accessories', 'hardware-accessories', 'Hardware and accessories', 'used')
ON CONFLICT (slug) DO NOTHING;
