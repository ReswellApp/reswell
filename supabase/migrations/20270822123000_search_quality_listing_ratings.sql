-- Per-listing Good / Close / Bad on a captured search result set.
-- Stored beside listings_preview so a later snapshot update does not wipe ratings.

ALTER TABLE public.search_quality_events
  ADD COLUMN IF NOT EXISTS listing_ratings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.search_quality_events.listing_ratings IS
  'Map of listing uuid → good|close|bad for per-result admin ratings used as NL memory.';
