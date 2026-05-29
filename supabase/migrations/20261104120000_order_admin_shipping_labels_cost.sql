-- Capture the carrier label cost on admin-prepared labels for shipping cost reconciliation.
-- Buyer-paid shipping lives on orders.shipping_amount; this records what Reswell actually paid
-- ShipEngine so admins can see margin per order and aggregate spend in the shipping dashboard.

ALTER TABLE public.order_admin_shipping_labels
  ADD COLUMN IF NOT EXISTS label_cost_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS label_cost_currency text;

COMMENT ON COLUMN public.order_admin_shipping_labels.label_cost_usd IS
  'Amount Reswell paid the carrier for this label (from ShipEngine shipment_cost). Null for manual uploads / tracking-only rows and labels purchased before this column existed.';

COMMENT ON COLUMN public.order_admin_shipping_labels.label_cost_currency IS
  'ISO currency for label_cost_usd (typically USD). Null when cost is unknown.';

CREATE INDEX IF NOT EXISTS order_admin_shipping_labels_created_at_idx
  ON public.order_admin_shipping_labels (created_at DESC);
