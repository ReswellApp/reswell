-- Ensure surfboard listing categories used by the app (`boardCategoryMap`) exist.
-- Run if `Step-Up / Gun` or `Other` are missing in Table Editor → public.categories.
-- IDs must match `lib/utils/board-type-from-category-id.ts`.

INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a',
    'Step-Up / Gun',
    'step-up-gun',
    'Step-ups and guns for heavier waves and bigger surf.',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  board = EXCLUDED.board;

INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    'c3d4e5f6-a7b8-49c0-b123-456789abcdef',
    'Other',
    'other',
    'Other surfboard shapes not listed above.',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  board = EXCLUDED.board;

-- Older migration used "Others" as display name; align with product copy.
UPDATE public.categories
SET name = 'Other'
WHERE id = 'c3d4e5f6-a7b8-49c0-b123-456789abcdef'
  AND name = 'Others';
