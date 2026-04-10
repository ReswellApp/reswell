-- Homepage hero slideshow: dedicated table (replaces reliance on public.images, which was never
-- created in-repo and may not exist on all environments).

CREATE TABLE IF NOT EXISTS public.home_hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_hero_slides_sort_idx ON public.home_hero_slides (sort_order, created_at);

ALTER TABLE public.home_hero_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_hero_slides_select_public" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_select_public" ON public.home_hero_slides FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_hero_slides_insert_admin" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_insert_admin" ON public.home_hero_slides FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_hero_slides_update_admin" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_update_admin" ON public.home_hero_slides FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_hero_slides_delete_admin" ON public.home_hero_slides;
CREATE POLICY "home_hero_slides_delete_admin" ON public.home_hero_slides FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
