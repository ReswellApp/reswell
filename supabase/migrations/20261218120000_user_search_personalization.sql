-- Per-user nav search personalization: recent queries + recently viewed listings.

CREATE TABLE IF NOT EXISTS public.user_recent_searches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query         TEXT NOT NULL CHECK (char_length(trim(query)) >= 1),
  query_normalized TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_recent_searches_user_query_unique UNIQUE (user_id, query_normalized)
);

CREATE INDEX IF NOT EXISTS user_recent_searches_user_updated_idx
  ON public.user_recent_searches (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.user_recently_viewed_listings (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS user_recently_viewed_listings_user_viewed_idx
  ON public.user_recently_viewed_listings (user_id, viewed_at DESC);

ALTER TABLE public.user_recent_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recently_viewed_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_recent_searches_own" ON public.user_recent_searches;
CREATE POLICY "user_recent_searches_own" ON public.user_recent_searches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_recently_viewed_listings_own" ON public.user_recently_viewed_listings;
CREATE POLICY "user_recently_viewed_listings_own" ON public.user_recently_viewed_listings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_recent_searches IS
  'Marketplace search queries saved for logged-in nav search personalization.';
COMMENT ON TABLE public.user_recently_viewed_listings IS
  'Listing detail views for logged-in recently viewed nav search strip.';
