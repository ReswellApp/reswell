-- Homepage listing curation: explicit rows for "Recently added" strips and How it works buyer images.
-- When a section has ≥1 curation row, the app shows only eligible curated listings (see app/page.tsx).
-- hidden_from_homepage: exclude listing from all homepage dynamic queries and curated display.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS hidden_from_homepage boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.hidden_from_homepage IS
  'When true, listing is omitted from the homepage (all sections, including hero fallback and How it works picks).';

CREATE TABLE IF NOT EXISTS public.home_recent_surfboards_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_recent_surfboards_listings_listing_unique UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS home_recent_surfboards_listings_sort_idx
  ON public.home_recent_surfboards_listings (sort_order, created_at);

ALTER TABLE public.home_recent_surfboards_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_recent_surfboards_listings_select_public" ON public.home_recent_surfboards_listings;
CREATE POLICY "home_recent_surfboards_listings_select_public" ON public.home_recent_surfboards_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_recent_surfboards_listings_insert_admin" ON public.home_recent_surfboards_listings;
CREATE POLICY "home_recent_surfboards_listings_insert_admin" ON public.home_recent_surfboards_listings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_recent_surfboards_listings_update_admin" ON public.home_recent_surfboards_listings;
CREATE POLICY "home_recent_surfboards_listings_update_admin" ON public.home_recent_surfboards_listings FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_recent_surfboards_listings_delete_admin" ON public.home_recent_surfboards_listings;
CREATE POLICY "home_recent_surfboards_listings_delete_admin" ON public.home_recent_surfboards_listings FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

CREATE TABLE IF NOT EXISTS public.home_recent_shortboards_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_recent_shortboards_listings_listing_unique UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS home_recent_shortboards_listings_sort_idx
  ON public.home_recent_shortboards_listings (sort_order, created_at);

ALTER TABLE public.home_recent_shortboards_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_recent_shortboards_listings_select_public" ON public.home_recent_shortboards_listings;
CREATE POLICY "home_recent_shortboards_listings_select_public" ON public.home_recent_shortboards_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_recent_shortboards_listings_insert_admin" ON public.home_recent_shortboards_listings;
CREATE POLICY "home_recent_shortboards_listings_insert_admin" ON public.home_recent_shortboards_listings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_recent_shortboards_listings_update_admin" ON public.home_recent_shortboards_listings;
CREATE POLICY "home_recent_shortboards_listings_update_admin" ON public.home_recent_shortboards_listings FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_recent_shortboards_listings_delete_admin" ON public.home_recent_shortboards_listings;
CREATE POLICY "home_recent_shortboards_listings_delete_admin" ON public.home_recent_shortboards_listings FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

CREATE TABLE IF NOT EXISTS public.home_how_it_works_buyer_listings (
  board_type text PRIMARY KEY CHECK (board_type IN ('shortboard', 'hybrid', 'longboard')),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_how_it_works_buyer_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_how_it_works_buyer_listings_select_public" ON public.home_how_it_works_buyer_listings;
CREATE POLICY "home_how_it_works_buyer_listings_select_public" ON public.home_how_it_works_buyer_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_how_it_works_buyer_listings_insert_admin" ON public.home_how_it_works_buyer_listings;
CREATE POLICY "home_how_it_works_buyer_listings_insert_admin" ON public.home_how_it_works_buyer_listings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_how_it_works_buyer_listings_update_admin" ON public.home_how_it_works_buyer_listings;
CREATE POLICY "home_how_it_works_buyer_listings_update_admin" ON public.home_how_it_works_buyer_listings FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_how_it_works_buyer_listings_delete_admin" ON public.home_how_it_works_buyer_listings;
CREATE POLICY "home_how_it_works_buyer_listings_delete_admin" ON public.home_how_it_works_buyer_listings FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
