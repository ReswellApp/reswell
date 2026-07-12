-- Staging table for manually imported Facebook Marketplace listings.
-- Admins ingest rows here first; later workflows promote them into brand_model_variants.

CREATE TABLE IF NOT EXISTS public.fb_marketplace_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10, 2),
  location text,
  image_url text,
  condition text,
  description text,
  source_url text,
  converted_brand_model_variant_id uuid REFERENCES public.brand_model_variants (id) ON DELETE SET NULL,
  converted_at timestamptz,
  dismissed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fb_marketplace_catalog_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT fb_marketplace_catalog_price_nonnegative CHECK (price IS NULL OR price >= 0),
  CONSTRAINT fb_marketplace_catalog_source_url_length CHECK (
    source_url IS NULL OR (length(trim(source_url)) > 0 AND length(source_url) <= 2048)
  )
);

CREATE INDEX IF NOT EXISTS fb_marketplace_catalog_created_at_idx
  ON public.fb_marketplace_catalog (created_at DESC);

CREATE INDEX IF NOT EXISTS fb_marketplace_catalog_pending_idx
  ON public.fb_marketplace_catalog (converted_at, dismissed_at)
  WHERE converted_at IS NULL AND dismissed_at IS NULL;

COMMENT ON TABLE public.fb_marketplace_catalog IS
  'Manual Facebook Marketplace import staging. Rows are reviewed and later migrated into brand_model_variants.';

COMMENT ON COLUMN public.fb_marketplace_catalog.name IS
  'FB listing title / product name.';

COMMENT ON COLUMN public.fb_marketplace_catalog.price IS
  'Listed price in USD when known; null for free or negotiable listings.';

COMMENT ON COLUMN public.fb_marketplace_catalog.location IS
  'Seller location label from the FB listing.';

COMMENT ON COLUMN public.fb_marketplace_catalog.image_url IS
  'Primary product image URL from the FB listing (external until mirrored).';

COMMENT ON COLUMN public.fb_marketplace_catalog.condition IS
  'Raw FB condition label (e.g. New, Used - Like New); normalized during catalog conversion.';

COMMENT ON COLUMN public.fb_marketplace_catalog.description IS
  'Full FB listing description text.';

COMMENT ON COLUMN public.fb_marketplace_catalog.source_url IS
  'Canonical Facebook Marketplace listing URL for dedupe and review.';

COMMENT ON COLUMN public.fb_marketplace_catalog.converted_brand_model_variant_id IS
  'Set when an admin publishes this row into brand_model_variants.';

ALTER TABLE public.fb_marketplace_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb_marketplace_catalog_select_admin" ON public.fb_marketplace_catalog;
CREATE POLICY "fb_marketplace_catalog_select_admin"
  ON public.fb_marketplace_catalog FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "fb_marketplace_catalog_insert_admin" ON public.fb_marketplace_catalog;
CREATE POLICY "fb_marketplace_catalog_insert_admin"
  ON public.fb_marketplace_catalog FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "fb_marketplace_catalog_update_admin" ON public.fb_marketplace_catalog;
CREATE POLICY "fb_marketplace_catalog_update_admin"
  ON public.fb_marketplace_catalog FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "fb_marketplace_catalog_delete_admin" ON public.fb_marketplace_catalog;
CREATE POLICY "fb_marketplace_catalog_delete_admin"
  ON public.fb_marketplace_catalog FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
