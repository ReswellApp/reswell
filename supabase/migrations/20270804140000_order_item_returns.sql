-- Per-item admin-authorized returns: prepaid return label (buyer → seller),
-- paperless QR, return tracking, and delayed refund after carrier delivery.

CREATE TABLE IF NOT EXISTS public.order_item_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE RESTRICT,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  item_price_usd numeric(12, 2) NOT NULL CHECK (item_price_usd >= 0),
  shipping_amount_usd numeric(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_amount_usd >= 0),
  refund_amount_usd numeric(12, 2) NOT NULL CHECK (refund_amount_usd >= 0),
  seller_clawback_usd numeric(12, 2) NOT NULL CHECK (seller_clawback_usd >= 0),

  status text NOT NULL DEFAULT 'authorized' CHECK (status IN (
    'authorized',
    'in_transit',
    'delivered',
    'refund_pending',
    'refunded',
    'cancelled'
  )),

  label_pdf_url text,
  label_storage_path text,
  shipengine_label_id text,
  shipengine_rate_id text,
  label_cost_usd numeric(12, 4),
  label_cost_currency text,

  paperless_qr_url text,
  paperless_qr_storage_path text,
  paperless_instructions text,
  paperless_handoff_code text,

  tracking_number text,
  tracking_carrier text,
  tracking_detail jsonb,
  carrier_delivered_at timestamptz,

  stripe_refund_id text,
  refunded_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active return per line item / listing (cancelled rows do not block a new authorization).
CREATE UNIQUE INDEX IF NOT EXISTS order_item_returns_active_order_item_uidx
  ON public.order_item_returns (order_item_id)
  WHERE order_item_id IS NOT NULL AND status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS order_item_returns_active_order_listing_uidx
  ON public.order_item_returns (order_id, listing_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS order_item_returns_order_id_idx
  ON public.order_item_returns (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_item_returns_tracking_number_idx
  ON public.order_item_returns (tracking_number)
  WHERE tracking_number IS NOT NULL AND btrim(tracking_number) <> '';

CREATE INDEX IF NOT EXISTS order_item_returns_refund_cron_idx
  ON public.order_item_returns (status, carrier_delivered_at)
  WHERE carrier_delivered_at IS NOT NULL
    AND status IN ('delivered', 'refund_pending');

COMMENT ON TABLE public.order_item_returns IS
  'Admin-authorized per-item returns. Label is purchased at authorize time; refund fires ~24h after return carrier delivery.';

COMMENT ON COLUMN public.order_item_returns.tracking_detail IS
  'ShipEngine tracking snapshot (same shape as orders.tracking_detail). Informational + drives delivery/refund clock.';

COMMENT ON COLUMN public.order_item_returns.carrier_delivered_at IS
  'First time carrier reported return delivery. Refund cron uses this + 24h hold.';

ALTER TABLE public.order_item_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_item_returns_select_as_order_party"
  ON public.order_item_returns FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

GRANT SELECT ON public.order_item_returns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_returns TO service_role;

-- Exclusive lock so only one worker may purchase a ShipEngine return label per return row.
CREATE TABLE IF NOT EXISTS public.order_item_return_label_purchase_locks (
  order_item_return_id uuid PRIMARY KEY
    REFERENCES public.order_item_returns(id) ON DELETE CASCADE,
  owner_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'purchased', 'failed')),
  shipengine_rate_id text,
  tracking_number text,
  tracking_carrier text,
  label_pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_item_return_label_purchase_locks_status_updated_idx
  ON public.order_item_return_label_purchase_locks (status, updated_at DESC);

COMMENT ON TABLE public.order_item_return_label_purchase_locks IS
  'Exclusive lock so only one worker may purchase a ShipEngine return label per order_item_return.';

ALTER TABLE public.order_item_return_label_purchase_locks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_return_label_purchase_locks TO service_role;
