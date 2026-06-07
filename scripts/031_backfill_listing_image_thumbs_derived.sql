-- Backfill thumbnail_url for listing_images rows whose full-resolution URL
-- follows the {userId}/{ts}-{clientId}-full.{ext} naming convention but whose
-- thumbnail_url column was never written (uploaded before the sell flow started
-- persisting the column, or inserted via the legacy API path).
--
-- The -thumb. sibling already exists in Supabase Storage for every -full. image
-- (both variants are uploaded in parallel by the client pipeline), so this is a
-- pure metadata update — no storage objects need to be created.
--
-- Safe to run repeatedly (WHERE … IS NULL is idempotent).

UPDATE public.listing_images
SET thumbnail_url = replace(url, '-full.', '-thumb.')
WHERE url  LIKE '%-full.%'
  AND thumbnail_url IS NULL;
