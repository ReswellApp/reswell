-- Surfboard collections (published showcases) + spot request queue
-- Run in Supabase SQL Editor after prior migrations.

-- 1) Users apply to be featured on /collections
CREATE TABLE IF NOT EXISTS public.collection_spot_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  social_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_spot_requests_one_pending_per_user
  ON public.collection_spot_requests (user_id)
  WHERE (status = 'pending');

ALTER TABLE public.collection_spot_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collection_spot_requests_insert_own" ON public.collection_spot_requests;
CREATE POLICY "collection_spot_requests_insert_own" ON public.collection_spot_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "collection_spot_requests_select_own_or_staff" ON public.collection_spot_requests;
CREATE POLICY "collection_spot_requests_select_own_or_staff" ON public.collection_spot_requests
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "collection_spot_requests_update_admin" ON public.collection_spot_requests;
CREATE POLICY "collection_spot_requests_update_admin" ON public.collection_spot_requests
  FOR UPDATE
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

-- 2) Published collection profiles (curated by team after approval)
CREATE TABLE IF NOT EXISTS public.surf_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  tagline TEXT,
  intro TEXT,
  cover_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS surf_collections_published_sort
  ON public.surf_collections (published, sort_order);

CREATE TABLE IF NOT EXISTS public.surf_collection_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.surf_collections(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS surf_collection_boards_collection_sort
  ON public.surf_collection_boards (collection_id, sort_order);

ALTER TABLE public.surf_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surf_collection_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "surf_collections_select_public" ON public.surf_collections;
CREATE POLICY "surf_collections_select_public" ON public.surf_collections
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS "surf_collections_select_staff" ON public.surf_collections;
CREATE POLICY "surf_collections_select_staff" ON public.surf_collections
  FOR SELECT
  USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "surf_collections_write_admin" ON public.surf_collections;
CREATE POLICY "surf_collections_write_admin" ON public.surf_collections
  FOR ALL
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true)
  WITH CHECK ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

DROP POLICY IF EXISTS "surf_collection_boards_select_public" ON public.surf_collection_boards;
CREATE POLICY "surf_collection_boards_select_public" ON public.surf_collection_boards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.surf_collections c
      WHERE c.id = collection_id AND c.published = true
    )
  );

DROP POLICY IF EXISTS "surf_collection_boards_select_staff_drafts" ON public.surf_collection_boards;
CREATE POLICY "surf_collection_boards_select_staff_drafts" ON public.surf_collection_boards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.surf_collections c
      WHERE c.id = collection_id
        AND c.published = false
        AND (
          (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
          OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
        )
    )
  );

DROP POLICY IF EXISTS "surf_collection_boards_write_admin" ON public.surf_collection_boards;
CREATE POLICY "surf_collection_boards_write_admin" ON public.surf_collection_boards
  FOR ALL
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true)
  WITH CHECK ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

-- After approving a request: set collection_spot_requests.status, then insert e.g.
-- INSERT INTO public.surf_collections (user_id, slug, title, tagline, intro, cover_image_url, published)
--   VALUES ('…profile uuid…', 'hayden-quiver', 'The daily drivers', 'Shortboards for home', 'Intro text…', 'https://…', true);
-- INSERT INTO public.surf_collection_boards (collection_id, image_url, caption, sort_order)
--   VALUES ('…collection uuid…', 'https://…', '5''10" ghost shape', 0);
