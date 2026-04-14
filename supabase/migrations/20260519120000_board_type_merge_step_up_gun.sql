-- Merge surfboard types step-up + gun into one shape: `step-up-gun` (category row 91c4e8a2…).

UPDATE public.listings
SET
  board_type = 'step-up-gun',
  category_id = '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a'
WHERE board_type IN ('step-up', 'gun');

UPDATE public.categories
SET
  name = 'Step-Up / Gun',
  slug = 'step-up-gun',
  description = 'Step-ups and guns for heavier waves and bigger surf.'
WHERE id = '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a';
