-- Remove dedicated homepage hero table; curated slides live in public.images (scope = 'home_hero').

DROP POLICY IF EXISTS "home_hero_slides_delete_admin" ON public.home_hero_slides;
DROP POLICY IF EXISTS "home_hero_slides_update_admin" ON public.home_hero_slides;
DROP POLICY IF EXISTS "home_hero_slides_insert_admin" ON public.home_hero_slides;
DROP POLICY IF EXISTS "home_hero_slides_select_public" ON public.home_hero_slides;

DROP TABLE IF EXISTS public.home_hero_slides;

-- Homepage hero rows are identified by scope; sort_order orders the slideshow.
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- If the table used image_url only, copy into url for hero + API use.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'images' AND column_name = 'image_url'
  ) THEN
    UPDATE public.images
    SET url = image_url
    WHERE (url IS NULL OR btrim(url) = '') AND image_url IS NOT NULL AND btrim(image_url::text) <> '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS images_scope_sort_idx ON public.images (scope, sort_order);

-- Enable RLS only if not already on (avoids surprising lockdown of unrelated image rows).
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Public can read homepage hero assets
DROP POLICY IF EXISTS "images_select_home_hero_public" ON public.images;
CREATE POLICY "images_select_home_hero_public" ON public.images FOR SELECT USING (scope = 'home_hero');

-- Marketplace admins manage homepage hero rows only
DROP POLICY IF EXISTS "images_insert_home_hero_admin" ON public.images;
CREATE POLICY "images_insert_home_hero_admin" ON public.images FOR INSERT TO authenticated
WITH CHECK (
  scope = 'home_hero'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "images_update_home_hero_admin" ON public.images;
CREATE POLICY "images_update_home_hero_admin" ON public.images FOR UPDATE TO authenticated
USING (
  scope = 'home_hero'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  scope = 'home_hero'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "images_delete_home_hero_admin" ON public.images;
CREATE POLICY "images_delete_home_hero_admin" ON public.images FOR DELETE TO authenticated
USING (
  scope = 'home_hero'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);
