-- Keep listings.board_type aligned with surfboard category_id.
-- Fish was re-added as its own shape; legacy rows may have category_id = Fish while
-- board_type still reads 'groveler' from older backfills.

UPDATE public.listings l
SET board_type = CASE c.slug
  WHEN 'shortboard' THEN 'shortboard'
  WHEN 'longboard' THEN 'longboard'
  WHEN 'hybrid' THEN 'hybrid'
  WHEN 'groveler' THEN 'groveler'
  WHEN 'fish' THEN 'fish'
  WHEN 'asym' THEN 'asym'
  WHEN 'step-up-gun' THEN 'step-up-gun'
  WHEN 'other' THEN 'other'
  ELSE l.board_type
END
FROM public.categories c
WHERE l.section = 'surfboards'
  AND l.category_id = c.id
  AND c.board = true
  AND c.slug IS NOT NULL
  AND l.board_type IS DISTINCT FROM CASE c.slug
    WHEN 'shortboard' THEN 'shortboard'
    WHEN 'longboard' THEN 'longboard'
    WHEN 'hybrid' THEN 'hybrid'
    WHEN 'groveler' THEN 'groveler'
    WHEN 'fish' THEN 'fish'
    WHEN 'asym' THEN 'asym'
    WHEN 'step-up-gun' THEN 'step-up-gun'
    WHEN 'other' THEN 'other'
    ELSE l.board_type
  END;
