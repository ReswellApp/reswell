-- Rename surfboard shape "funboard" (Mid-length) → "hybrid" (Hybrid); update category slug.

UPDATE public.listings
SET board_type = 'hybrid'
WHERE board_type = 'funboard';

UPDATE public.categories
SET
  name = 'Hybrid',
  slug = 'hybrid',
  description = 'Hybrid surfboards — between shortboard and longboard.'
WHERE id = '93b8eeaf-366b-4823-8bb9-98d42c5fefba'
   OR slug = 'mid-length';
