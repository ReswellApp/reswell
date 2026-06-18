-- Track which listing variant was purchased (Shopify multi-variant listings).

BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS listing_variant_id uuid REFERENCES public.listing_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_items_listing_variant_id_idx
  ON public.order_items (listing_variant_id)
  WHERE listing_variant_id IS NOT NULL;

COMMENT ON COLUMN public.order_items.listing_variant_id IS
  'Purchasable variant unit when the listing has_variants (e.g. Shopify size/color).';

COMMIT;
