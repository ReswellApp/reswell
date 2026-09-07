-- Admin home ops tiles: carrier drop-off as the close condition for open
-- shipping orders, plus persisted ShipEngine post-shipment fee adjustments.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier_accepted_at timestamptz;

COMMENT ON COLUMN public.orders.carrier_accepted_at IS
  'First timestamp when ShipEngine tracking reported the package was dropped off / scanned (AC, IT, AT, OF, DE, EX, or actual_delivery_date). Source of truth for “open shipping order”.';

CREATE INDEX IF NOT EXISTS orders_open_shipping_awaiting_dropoff_idx
  ON public.orders (created_at DESC)
  WHERE fulfillment_method = 'shipping'
    AND status = 'confirmed'
    AND carrier_accepted_at IS NULL
    AND COALESCE(is_admin_test, false) = false
    AND delivery_status IS DISTINCT FROM 'delivered'
    AND delivery_status IS DISTINCT FROM 'picked_up';

CREATE INDEX IF NOT EXISTS orders_open_pickup_awaiting_code_idx
  ON public.orders (created_at DESC)
  WHERE fulfillment_method = 'pickup'
    AND status = 'confirmed'
    AND COALESCE(is_admin_test, false) = false
    AND delivery_status IS DISTINCT FROM 'picked_up';

-- Backfill drop-off from cached tracking snapshots (same scan codes as
-- carrierTrackingIndicatesScanned).
UPDATE public.orders o
SET
  carrier_accepted_at = COALESCE(
    NULLIF(trim(o.tracking_detail->>'actual_delivery_date'), '')::timestamptz,
    NULLIF(trim(o.tracking_detail->'events'->0->>'occurred_at'), '')::timestamptz,
    NULLIF(trim(o.tracking_detail->>'updated_at'), '')::timestamptz,
    o.carrier_delivered_at,
    o.updated_at
  )
WHERE o.fulfillment_method = 'shipping'
  AND o.carrier_accepted_at IS NULL
  AND (
    o.carrier_delivered_at IS NOT NULL
    OR (
      o.tracking_detail IS NOT NULL
      AND (
        upper(coalesce(o.tracking_detail->>'status_code', '')) IN ('AC', 'IT', 'AT', 'OF', 'DE', 'EX')
        OR NULLIF(trim(o.tracking_detail->>'actual_delivery_date'), '') IS NOT NULL
      )
    )
  );

CREATE TABLE IF NOT EXISTS public.shipengine_adjustment_reports (
  report_id text PRIMARY KEY,
  report_created_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  row_count integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.shipengine_adjustment_reports IS
  'ShipEngine nightly adjustment reports already ingested into shipengine_label_adjustments.';

ALTER TABLE public.shipengine_adjustment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipengine_adjustment_reports_select_admin"
  ON public.shipengine_adjustment_reports;
CREATE POLICY "shipengine_adjustment_reports_select_admin"
  ON public.shipengine_adjustment_reports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE TABLE IF NOT EXISTS public.shipengine_label_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL REFERENCES public.shipengine_adjustment_reports(report_id) ON DELETE CASCADE,
  transaction_id text NOT NULL,
  adjustment_id text,
  shipment_id text,
  tracking_number text,
  adjustment_type text,
  reason_code text,
  adjustment_amount_usd numeric(12, 2) NOT NULL,
  adjustment_at timestamptz,
  actual_service text,
  actual_package text,
  actual_weight numeric(12, 4),
  actual_length numeric(12, 2),
  actual_width numeric(12, 2),
  actual_height numeric(12, 2),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS shipengine_label_adjustments_increased_idx
  ON public.shipengine_label_adjustments (adjustment_at DESC NULLS LAST, created_at DESC)
  WHERE adjustment_amount_usd > 0;

CREATE INDEX IF NOT EXISTS shipengine_label_adjustments_order_id_idx
  ON public.shipengine_label_adjustments (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS shipengine_label_adjustments_tracking_idx
  ON public.shipengine_label_adjustments (tracking_number)
  WHERE tracking_number IS NOT NULL;

COMMENT ON TABLE public.shipengine_label_adjustments IS
  'Post-shipment ShipEngine / carrier fee adjustments. Positive amount_usd is a price increase.';

ALTER TABLE public.shipengine_label_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipengine_label_adjustments_select_admin"
  ON public.shipengine_label_adjustments;
CREATE POLICY "shipengine_label_adjustments_select_admin"
  ON public.shipengine_label_adjustments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
