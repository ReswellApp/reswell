-- Asym surfboard category (asymmetric shapes). ID must match `boardCategoryMap.asym` in app code.

INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    'b6c7d8e9-f0a1-4234-b567-890abcdef012',
    'Asym',
    'asym',
    'Asymmetric surfboards — different rail lines and fin setups for toe-side and heel-side surfing.',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board = EXCLUDED.board;
