-- Require non-null thread body (matches app: description required on create).
-- Run once if forum_threads already existed with nullable body.

UPDATE public.forum_threads SET body = '' WHERE body IS NULL;

ALTER TABLE public.forum_threads ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.forum_threads ALTER COLUMN body SET NOT NULL;

-- Remove legacy seeded intro copy from the default thread (if unchanged)
UPDATE public.forum_threads
SET body = ''
WHERE slug = 'new-board-stoke-thread'
  AND body LIKE 'Share the stoke%';
