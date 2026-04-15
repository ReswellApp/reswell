-- Dedicated surfboard category for "Other" (app `board_type` = other).
-- Previously `boardCategoryMap.other` reused the shortboard UUID, so /sell could not show a separate option.

INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    'c3d4e5f6-a7b8-49c0-b123-456789abcdef',
    'Other',
    'other',
    'Other surfboard shapes not listed above.',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board = EXCLUDED.board;
