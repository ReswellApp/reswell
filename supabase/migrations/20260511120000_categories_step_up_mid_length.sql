-- Add Step-Up surfboard category; rename Mid-length row (drop "funboard" from copy).

INSERT INTO public.categories (id, name, slug, description, board)
VALUES (
  '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a',
  'Step-Up',
  'step-up',
  'Step-up surfboards for heavier waves — extra length and volume over a daily driver.',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  board = EXCLUDED.board;

-- Mid-length: clearer name/description (matches app `board_type` = funboard).
UPDATE public.categories
SET
  name = 'Mid-length',
  description = 'Mid-length surfboards — between shortboard and longboard.'
WHERE slug = 'mid-length';

-- Deployments that map funboard to this fixed category id (see app/sell/page.tsx boardCategoryMap).
UPDATE public.categories
SET
  name = 'Mid-length',
  description = 'Mid-length surfboards — between shortboard and longboard.'
WHERE id = '93b8eeaf-366b-4823-8bb9-98d42c5fefba';
