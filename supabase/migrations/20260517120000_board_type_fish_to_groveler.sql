-- Rename surfboard shape "fish" → "groveler" (listings.board_type + categories.slug for surfboard rows).

UPDATE public.listings
SET board_type = 'groveler'
WHERE board_type = 'fish';

UPDATE public.categories
SET
  name = 'Groveler',
  slug = 'groveler',
  description = 'Small-wave grovelers and hybrid shapes.'
WHERE slug = 'fish';
