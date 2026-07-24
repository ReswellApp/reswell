-- Reswell shop listings (`section = new`) are not marketplace categories.
-- Allow null category_id and clear shop products so they live only in /reswell/shop.

ALTER TABLE public.listings
  ALTER COLUMN category_id DROP NOT NULL;

UPDATE public.listings
SET category_id = NULL
WHERE section = 'new';
