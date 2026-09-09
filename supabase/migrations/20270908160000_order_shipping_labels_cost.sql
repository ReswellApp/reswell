-- Persist what Reswell paid ShipEngine on marketplace labels (auto checkout + seller-paid).
-- Admin-prepared labels already store label_cost_usd; this closes the same gap for
-- order_shipping_labels so postage spend can be reconciled without re-querying ShipEngine.

ALTER TABLE public.order_shipping_labels
  ADD COLUMN IF NOT EXISTS label_cost_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS label_cost_currency text;

COMMENT ON COLUMN public.order_shipping_labels.label_cost_usd IS
  'Amount Reswell paid the carrier for this label (from ShipEngine shipment_cost). Null for labels purchased before this column existed.';

COMMENT ON COLUMN public.order_shipping_labels.label_cost_currency IS
  'ISO currency for label_cost_usd (typically USD). Null when cost is unknown.';
