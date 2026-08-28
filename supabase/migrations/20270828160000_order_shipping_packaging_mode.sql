-- Multi-package peer orders: ship together (one box) vs ship separately (one label per line).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_packaging_mode text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_packaging_mode_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_packaging_mode_check
  CHECK (
    shipping_packaging_mode IS NULL
    OR shipping_packaging_mode IN ('together', 'separate')
  );

COMMENT ON COLUMN public.orders.shipping_packaging_mode IS
  'Peer multi-item shipping: together = one combined carton/label; separate = one package and label per order line. NULL for pickup or single-item.';

ALTER TABLE public.order_shipping_labels
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_shipping_labels_order_item_id_idx
  ON public.order_shipping_labels (order_item_id)
  WHERE order_item_id IS NOT NULL;

COMMENT ON COLUMN public.order_shipping_labels.order_item_id IS
  'When the order ships separately, the order line this label covers. NULL for one-box / together shipments.';

-- Allow multiple tracked marketplace labels per order (one per package).
DROP INDEX IF EXISTS public.order_shipping_labels_one_tracked_per_order_uidx;

-- Skip when legacy duplicate tracked labels already exist (same pattern as
-- 20260723180000_shipengine_label_purchase_locks). App logic still prefers
-- package-scoped labels; this index is belt-and-suspenders for new together rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.order_shipping_labels
    WHERE tracking_number IS NOT NULL
      AND btrim(tracking_number) <> ''
      AND order_item_id IS NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE
      'Skipping order_shipping_labels_one_tracked_together_uidx — duplicate tracked labels already exist for one or more orders';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS order_shipping_labels_one_tracked_together_uidx
      ON public.order_shipping_labels (order_id)
      WHERE tracking_number IS NOT NULL
        AND btrim(tracking_number) <> ''
        AND order_item_id IS NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS order_shipping_labels_one_tracked_per_item_uidx
  ON public.order_shipping_labels (order_item_id)
  WHERE tracking_number IS NOT NULL
    AND btrim(tracking_number) <> ''
    AND order_item_id IS NOT NULL;

-- Package-scoped ShipEngine purchase locks (together | order_item uuid).
ALTER TABLE public.shipengine_label_purchase_locks
  ADD COLUMN IF NOT EXISTS package_key text NOT NULL DEFAULT 'together';

UPDATE public.shipengine_label_purchase_locks
SET package_key = 'together'
WHERE package_key IS NULL OR btrim(package_key) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipengine_label_purchase_locks_pkey'
      AND conrelid = 'public.shipengine_label_purchase_locks'::regclass
  ) THEN
    ALTER TABLE public.shipengine_label_purchase_locks
      DROP CONSTRAINT shipengine_label_purchase_locks_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipengine_label_purchase_locks_pkey'
      AND conrelid = 'public.shipengine_label_purchase_locks'::regclass
  ) THEN
    ALTER TABLE public.shipengine_label_purchase_locks
      ADD PRIMARY KEY (order_id, package_key);
  END IF;
END $$;

COMMENT ON COLUMN public.shipengine_label_purchase_locks.package_key IS
  'together for one-box labels; otherwise the order_items.id this package label covers.';
