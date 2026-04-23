-- Homepage hero carousel: admins curate a set of listings whose primary images appear
-- in the slideshow. Empty table = fallback to most-recent active surfboard listings
-- (handled in app/page.tsx). ON DELETE CASCADE so removing a listing drops its curation row.

CREATE TABLE IF NOT EXISTS public.home_hero_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_hero_listings_listing_unique UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS home_hero_listings_sort_idx
  ON public.home_hero_listings (sort_order, created_at);

ALTER TABLE public.home_hero_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_hero_listings_select_public" ON public.home_hero_listings;
CREATE POLICY "home_hero_listings_select_public" ON public.home_hero_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_hero_listings_insert_admin" ON public.home_hero_listings;
CREATE POLICY "home_hero_listings_insert_admin" ON public.home_hero_listings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_hero_listings_update_admin" ON public.home_hero_listings;
CREATE POLICY "home_hero_listings_update_admin" ON public.home_hero_listings FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_hero_listings_delete_admin" ON public.home_hero_listings;
CREATE POLICY "home_hero_listings_delete_admin" ON public.home_hero_listings FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
