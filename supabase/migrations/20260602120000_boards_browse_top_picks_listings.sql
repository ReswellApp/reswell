-- Admin-curated Top Picks for /boards browse (shown first when sort=top-picks, the default).

CREATE TABLE IF NOT EXISTS public.boards_browse_top_picks_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boards_browse_top_picks_listings_listing_unique UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS boards_browse_top_picks_listings_sort_idx
  ON public.boards_browse_top_picks_listings (sort_order, created_at);

ALTER TABLE public.boards_browse_top_picks_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards_browse_top_picks_listings_select_public" ON public.boards_browse_top_picks_listings;
CREATE POLICY "boards_browse_top_picks_listings_select_public" ON public.boards_browse_top_picks_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "boards_browse_top_picks_listings_insert_admin" ON public.boards_browse_top_picks_listings;
CREATE POLICY "boards_browse_top_picks_listings_insert_admin" ON public.boards_browse_top_picks_listings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "boards_browse_top_picks_listings_update_admin" ON public.boards_browse_top_picks_listings;
CREATE POLICY "boards_browse_top_picks_listings_update_admin" ON public.boards_browse_top_picks_listings FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "boards_browse_top_picks_listings_delete_admin" ON public.boards_browse_top_picks_listings;
CREATE POLICY "boards_browse_top_picks_listings_delete_admin" ON public.boards_browse_top_picks_listings FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
