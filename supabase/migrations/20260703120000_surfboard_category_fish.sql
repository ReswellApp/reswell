-- Fish surfboard category (distinct from groveler). ID must match `boardCategoryMap.fish` in app code.

INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    'a5b6c7d8-e9f0-4123-a456-7890abcdef01',
    'Fish',
    'fish',
    'Fish surfboards — wide, flat, and fast in small to medium surf.',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board = EXCLUDED.board;

UPDATE public.categories
SET description = 'Small-wave grovelers for mushy beach breaks.'
WHERE id = 'f3ccddc0-f0f3-45d3-ad43-51bcf9935b45'
  AND slug = 'groveler';
