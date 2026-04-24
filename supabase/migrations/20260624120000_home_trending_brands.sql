-- Homepage "Trending brands" strip: admins curate brand rows from the public `brands` catalog.
-- Empty table = section hidden for non-admins. ON DELETE CASCADE removes picks when a brand is deleted.

CREATE TABLE IF NOT EXISTS public.home_trending_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_trending_brands_brand_unique UNIQUE (brand_id)
);

CREATE INDEX IF NOT EXISTS home_trending_brands_sort_idx
  ON public.home_trending_brands (sort_order, created_at);

CREATE INDEX IF NOT EXISTS home_trending_brands_brand_id_idx
  ON public.home_trending_brands (brand_id);

ALTER TABLE public.home_trending_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_trending_brands_select_public" ON public.home_trending_brands;
CREATE POLICY "home_trending_brands_select_public" ON public.home_trending_brands FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_trending_brands_insert_admin" ON public.home_trending_brands;
CREATE POLICY "home_trending_brands_insert_admin" ON public.home_trending_brands FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_trending_brands_update_admin" ON public.home_trending_brands;
CREATE POLICY "home_trending_brands_update_admin" ON public.home_trending_brands FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "home_trending_brands_delete_admin" ON public.home_trending_brands;
CREATE POLICY "home_trending_brands_delete_admin" ON public.home_trending_brands FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
