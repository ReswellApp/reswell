-- Retire Foam / Soft Top surfboard category: reassign affected listings, then delete category row(s).
-- Matches app `boardCategoryMap` shortboard id and legacy `soft-top` slug from schema seed.

BEGIN;

UPDATE public.listings
SET
  category_id = '7e434a96-f3f7-4a73-b733-704a769195e6',
  board_type = CASE
    WHEN board_type = 'foamie' THEN 'other'
    ELSE board_type
  END,
  updated_at = now()
WHERE board_type = 'foamie'
   OR category_id IN (
     SELECT c.id
     FROM public.categories AS c
     WHERE c.slug IN ('soft-top', 'foamie')
        OR c.id = '7cc95cb5-2391-4e53-a48e-42977bf9504b'
   );

DELETE FROM public.categories AS c
WHERE c.slug IN ('soft-top', 'foamie')
   OR c.id = '7cc95cb5-2391-4e53-a48e-42977bf9504b';

COMMIT;
