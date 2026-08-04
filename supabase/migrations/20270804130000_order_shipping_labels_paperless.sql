-- USPS Label Broker / ShipEngine paperless QR codes for seller drop-off without printing.

ALTER TABLE public.order_shipping_labels
  ADD COLUMN IF NOT EXISTS paperless_qr_url text,
  ADD COLUMN IF NOT EXISTS paperless_qr_storage_path text,
  ADD COLUMN IF NOT EXISTS paperless_instructions text,
  ADD COLUMN IF NOT EXISTS paperless_handoff_code text;

COMMENT ON COLUMN public.order_shipping_labels.paperless_qr_url IS
  'External ShipEngine paperless QR image URL (Label Broker). Prefer paperless_qr_storage_path when set.';
COMMENT ON COLUMN public.order_shipping_labels.paperless_qr_storage_path IS
  'Path in order-shipping-labels bucket for the paperless QR PNG/JPEG.';
COMMENT ON COLUMN public.order_shipping_labels.paperless_instructions IS
  'Carrier instructions returned with the paperless label.';
COMMENT ON COLUMN public.order_shipping_labels.paperless_handoff_code IS
  'Optional handoff / Label Broker code for USPS drop-off.';

ALTER TABLE public.order_admin_shipping_labels
  ADD COLUMN IF NOT EXISTS paperless_qr_url text,
  ADD COLUMN IF NOT EXISTS paperless_qr_storage_path text,
  ADD COLUMN IF NOT EXISTS paperless_instructions text,
  ADD COLUMN IF NOT EXISTS paperless_handoff_code text;

COMMENT ON COLUMN public.order_admin_shipping_labels.paperless_qr_url IS
  'External ShipEngine paperless QR image URL (Label Broker). Prefer paperless_qr_storage_path when set.';
COMMENT ON COLUMN public.order_admin_shipping_labels.paperless_qr_storage_path IS
  'Path in order-shipping-labels bucket for the paperless QR PNG/JPEG.';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
]::text[]
WHERE id = 'order-shipping-labels';
