-- Prevent double ShipEngine label purchases for the same order.
-- Card finalize + Stripe webhook (and wallet/admin/auto paths) must share one lock
-- before calling POST /v1/labels/rates/{rate_id}.

CREATE TABLE IF NOT EXISTS public.shipengine_label_purchase_locks (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'purchased', 'failed')),
  shipengine_rate_id text,
  tracking_number text,
  tracking_carrier text,
  label_pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipengine_label_purchase_locks_status_updated_idx
  ON public.shipengine_label_purchase_locks (status, updated_at DESC);

COMMENT ON TABLE public.shipengine_label_purchase_locks IS
  'Exclusive lock so only one worker may purchase a ShipEngine label per order. Status purchased stores the winning label summary for waiters.';

ALTER TABLE public.shipengine_label_purchase_locks ENABLE ROW LEVEL SECURITY;

-- At most one completed marketplace label row per order (belt-and-suspenders after purchase).
-- Skip when legacy duplicates already exist so the migration still applies cleanly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.order_shipping_labels
    WHERE tracking_number IS NOT NULL AND btrim(tracking_number) <> ''
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS order_shipping_labels_one_tracked_per_order_uidx
      ON public.order_shipping_labels (order_id)
      WHERE tracking_number IS NOT NULL AND btrim(tracking_number) <> '';
  ELSE
    RAISE NOTICE 'Skipping order_shipping_labels_one_tracked_per_order_uidx — duplicate tracked labels already exist';
  END IF;
END $$;
