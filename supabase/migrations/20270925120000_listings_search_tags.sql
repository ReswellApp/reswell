-- Admin-curated search keywords on a listing (e.g. "fish") so it can match
-- that query / board-style browse without changing the seller-facing board_type.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS search_tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.listings.search_tags IS
  'Admin-only search keywords attached to a listing. Indexed for marketplace search and OR-matched into board-style browse when a tag is a style slug (fish, shortboard, …).';

CREATE INDEX IF NOT EXISTS listings_search_tags_gin_idx
  ON public.listings
  USING gin (search_tags);
