-- Marketplace-prepared shipping labels (post-checkout ShipEngine automation).
-- Manual admin labels stay in order_admin_shipping_labels.

CREATE TABLE IF NOT EXISTS public.order_shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  origin text NOT NULL CHECK (origin IN ('auto_reswell_checkout')),
  label_pdf_url text,
  label_storage_path text,
  tracking_number text,
  tracking_carrier text,
  shipengine_rate_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_shipping_labels_order_id_idx
  ON public.order_shipping_labels (order_id DESC, created_at DESC);

COMMENT ON TABLE public.order_shipping_labels IS
  'Labels purchased by Reswell for peer orders (e.g. post-checkout automation). Sellers download via the sale page; does not mark the order shipped.';

COMMENT ON COLUMN public.order_shipping_labels.origin IS
  'How the label was created. auto_reswell_checkout = ShipEngine purchase after Reswell shipping checkout.';

ALTER TABLE public.order_shipping_labels ENABLE ROW LEVEL SECURITY;

-- PDFs use the existing order-shipping-labels bucket (created with order_admin_shipping_labels migration).
-- App reads via service-role signed URLs on the seller sale page; automation inserts via service role.
