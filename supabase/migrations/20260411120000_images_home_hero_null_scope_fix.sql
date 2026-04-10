-- Legacy / manual rows often have scope NULL after adding the column, so they were invisible
-- to SELECT (RLS) and to .eq('scope','home_hero') queries. Align RLS + backfill scope.

-- Public read: homepage hero = explicit tag OR legacy NULL (narrow after backfill).
DROP POLICY IF EXISTS "images_select_home_hero_public" ON public.images;
CREATE POLICY "images_select_home_hero_public" ON public.images FOR SELECT
USING (scope = 'home_hero' OR scope IS NULL);

DROP POLICY IF EXISTS "images_update_home_hero_admin" ON public.images;
CREATE POLICY "images_update_home_hero_admin" ON public.images FOR UPDATE TO authenticated
USING (
  (scope = 'home_hero' OR scope IS NULL)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  (scope = 'home_hero' OR scope IS NULL)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "images_delete_home_hero_admin" ON public.images;
CREATE POLICY "images_delete_home_hero_admin" ON public.images FOR DELETE TO authenticated
USING (
  (scope = 'home_hero' OR scope IS NULL)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

-- Optional: set scope explicitly for hero rows, e.g. if the table is hero-only:
-- UPDATE public.images SET scope = 'home_hero' WHERE scope IS NULL;
