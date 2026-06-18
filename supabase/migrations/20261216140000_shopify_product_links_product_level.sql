-- Move shopify_product_links from one-row-per-variant to one-row-per-product.
-- Variant-level mapping now lives in listing_variants (shopify_variant_id), so a single Shopify
-- product maps to a single Reswell listing with an in-listing variant picker.

BEGIN;

-- Old per-variant uniqueness no longer applies.
ALTER TABLE public.shopify_product_links
  DROP CONSTRAINT IF EXISTS shopify_product_links_connection_id_shopify_variant_id_key;
ALTER TABLE public.shopify_product_links
  DROP CONSTRAINT IF EXISTS shopify_product_links_listing_id_key;

-- Product-level links don't require a variant id (variants live in listing_variants).
ALTER TABLE public.shopify_product_links
  ALTER COLUMN shopify_variant_id DROP NOT NULL;

-- One link per (connection, product). Use a unique index (idempotent, survives re-runs).
CREATE UNIQUE INDEX IF NOT EXISTS shopify_product_links_connection_product_idx
  ON public.shopify_product_links (connection_id, shopify_product_id);

COMMENT ON TABLE public.shopify_product_links IS
  'Maps a Shopify product to a single Reswell listing. Per-variant detail lives in listing_variants.';

COMMIT;
