-- Tag brands with the product categories they manufacture (surfboards, fins, wetsuits, …).

CREATE TABLE IF NOT EXISTS public.brand_product_categories (
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  category_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, category_slug),
  CONSTRAINT brand_product_categories_slug_valid CHECK (
    category_slug IN (
      'surfboards',
      'fins',
      'wetsuits',
      'boardbags',
      'surfpacks',
      'leashes',
      'apparel',
      'accessories'
    )
  )
);

CREATE INDEX IF NOT EXISTS brand_product_categories_slug_idx
  ON public.brand_product_categories (category_slug);

COMMENT ON TABLE public.brand_product_categories IS
  'Many-to-many tags linking catalog brands to the product types they manufacture.';

-- Existing surfboard shapers default to surfboards; admins can add fins, wetsuits, etc.
INSERT INTO public.brand_product_categories (brand_id, category_slug)
SELECT b.id, 'surfboards'
FROM public.brands b
ON CONFLICT DO NOTHING;

ALTER TABLE public.brand_product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_product_categories_select_public" ON public.brand_product_categories;
CREATE POLICY "brand_product_categories_select_public"
  ON public.brand_product_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "brand_product_categories_insert_admin" ON public.brand_product_categories;
CREATE POLICY "brand_product_categories_insert_admin"
  ON public.brand_product_categories FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "brand_product_categories_update_admin" ON public.brand_product_categories;
CREATE POLICY "brand_product_categories_update_admin"
  ON public.brand_product_categories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "brand_product_categories_delete_admin" ON public.brand_product_categories;
CREATE POLICY "brand_product_categories_delete_admin"
  ON public.brand_product_categories FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
