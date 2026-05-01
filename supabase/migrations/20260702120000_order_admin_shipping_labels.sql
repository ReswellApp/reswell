-- Admin-prepared shipping labels / tracking (does not set delivery_status shipped).

CREATE TABLE IF NOT EXISTS public.order_admin_shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN (
    'shipengine_checkout_lane',
    'manual_label_upload',
    'manual_tracking_buyer'
  )),
  label_pdf_url text,
  label_storage_path text,
  tracking_number text,
  tracking_carrier text,
  shipengine_rate_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_admin_shipping_labels_order_id_idx
  ON public.order_admin_shipping_labels (order_id DESC, created_at DESC);

COMMENT ON TABLE public.order_admin_shipping_labels IS
  'Labels and tracking supplied by marketplace admins. Updating tracking here does not mark the order shipped; seller confirms shipment separately.';

ALTER TABLE public.order_admin_shipping_labels ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-shipping-labels',
  'order-shipping-labels',
  false,
  15728640,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "order_shipping_labels_insert_admin" ON storage.objects;
CREATE POLICY "order_shipping_labels_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'order-shipping-labels'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "order_shipping_labels_select_admin" ON storage.objects;
CREATE POLICY "order_shipping_labels_select_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'order-shipping-labels'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
