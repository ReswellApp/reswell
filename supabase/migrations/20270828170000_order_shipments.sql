-- First-class shipments for peer marketplace orders.
-- One shipment for together packaging; one shipment per order line for separate.
-- Carrier tracking + delivery clocks live on shipments; orders keep a rollup.
--
-- Safe to re-run after a partial failure: inserts/links are gated, label attach
-- links at most one tracked label per shipment, then the unique index is added.

CREATE TABLE IF NOT EXISTS public.order_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  packaging_kind text NOT NULL
    CHECK (packaging_kind IN ('together', 'separate_item')),
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'shipped', 'delivered')),
  tracking_number text,
  tracking_carrier text,
  tracking_detail jsonb,
  carrier_accepted_at timestamptz,
  carrier_delivered_at timestamptz,
  -- Checkout-selected ShipEngine rate (Reswell shipping), purchased later per shipment.
  shipengine_rate_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_shipments_order_id_idx
  ON public.order_shipments (order_id, sort_order);

CREATE INDEX IF NOT EXISTS order_shipments_tracking_number_idx
  ON public.order_shipments (tracking_number)
  WHERE tracking_number IS NOT NULL AND btrim(tracking_number) <> '';

CREATE INDEX IF NOT EXISTS order_shipments_open_carrier_idx
  ON public.order_shipments (delivery_status, updated_at DESC)
  WHERE tracking_number IS NOT NULL AND btrim(tracking_number) <> '';

COMMENT ON TABLE public.order_shipments IS
  'Physical packages for a marketplace order. Together = one row covering all lines; separate = one row per order_item.';

COMMENT ON COLUMN public.order_shipments.packaging_kind IS
  'together = combined carton; separate_item = single order line package.';

COMMENT ON COLUMN public.order_shipments.delivery_status IS
  'Package-level fulfillment. Order delivery_status is a rollup of its shipments.';

CREATE TABLE IF NOT EXISTS public.order_shipment_items (
  shipment_id uuid NOT NULL REFERENCES public.order_shipments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  PRIMARY KEY (shipment_id, order_item_id)
);

-- Each order line belongs to at most one shipment.
CREATE UNIQUE INDEX IF NOT EXISTS order_shipment_items_order_item_uidx
  ON public.order_shipment_items (order_item_id);

CREATE INDEX IF NOT EXISTS order_shipment_items_shipment_id_idx
  ON public.order_shipment_items (shipment_id);

COMMENT ON TABLE public.order_shipment_items IS
  'Join of shipments to order_items. Separate packaging: one item per shipment. Together: all items on one shipment.';

ALTER TABLE public.order_shipping_labels
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.order_shipments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_shipping_labels_shipment_id_idx
  ON public.order_shipping_labels (shipment_id)
  WHERE shipment_id IS NOT NULL;

COMMENT ON COLUMN public.order_shipping_labels.shipment_id IS
  'Shipment this marketplace label covers. Preferred over order_item_id for multi-package orders.';

-- Drop unique index if a prior partial run created it (re-attach labels safely below).
DROP INDEX IF EXISTS public.order_shipping_labels_one_tracked_per_shipment_uidx;

-- Clear shipment links from a failed prior run so we can re-attach at most one tracked label each.
UPDATE public.order_shipping_labels
SET shipment_id = NULL
WHERE shipment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill: one together shipment per existing shipping order that has items.
-- ---------------------------------------------------------------------------
INSERT INTO public.order_shipments (
  order_id,
  sort_order,
  packaging_kind,
  delivery_status,
  tracking_number,
  tracking_carrier,
  tracking_detail,
  carrier_accepted_at,
  carrier_delivered_at,
  created_at,
  updated_at
)
SELECT
  o.id,
  0,
  CASE
    WHEN o.shipping_packaging_mode = 'separate' THEN 'separate_item'
    ELSE 'together'
  END,
  CASE
    WHEN o.delivery_status IN ('shipped', 'delivered') THEN o.delivery_status
    ELSE 'pending'
  END,
  NULLIF(btrim(o.tracking_number), ''),
  NULLIF(btrim(o.tracking_carrier), ''),
  o.tracking_detail,
  o.carrier_accepted_at,
  o.carrier_delivered_at,
  COALESCE(o.created_at, now()),
  now()
FROM public.orders o
WHERE o.fulfillment_method = 'shipping'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_shipments s WHERE s.order_id = o.id
  )
  AND EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
  );

-- Link all lines onto the backfilled shipment for together (and temporary for separate).
INSERT INTO public.order_shipment_items (shipment_id, order_item_id)
SELECT s.id, oi.id
FROM public.order_shipments s
JOIN public.order_items oi ON oi.order_id = s.order_id
WHERE s.packaging_kind = 'together'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_shipment_items x WHERE x.order_item_id = oi.id
  );

-- Separate-mode historical orders: split into one shipment per line when possible.
DO $$
DECLARE
  rec RECORD;
  first_item uuid;
  first_ship uuid;
  item_rec RECORD;
  new_ship uuid;
  idx integer;
BEGIN
  FOR rec IN
    SELECT o.id AS order_id
    FROM public.orders o
    WHERE o.fulfillment_method = 'shipping'
      AND o.shipping_packaging_mode = 'separate'
  LOOP
    SELECT s.id INTO first_ship
    FROM public.order_shipments s
    WHERE s.order_id = rec.order_id
    ORDER BY s.sort_order, s.created_at
    LIMIT 1;

    IF first_ship IS NULL THEN
      CONTINUE;
    END IF;

    SELECT oi.id INTO first_item
    FROM public.order_items oi
    WHERE oi.order_id = rec.order_id
    ORDER BY oi.sort_order, oi.id
    LIMIT 1;

    UPDATE public.order_shipments
    SET packaging_kind = 'separate_item', updated_at = now()
    WHERE id = first_ship;

    DELETE FROM public.order_shipment_items
    WHERE shipment_id = first_ship
      AND order_item_id IS DISTINCT FROM first_item;

    IF first_item IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.order_shipment_items WHERE shipment_id = first_ship
    ) THEN
      INSERT INTO public.order_shipment_items (shipment_id, order_item_id)
      VALUES (first_ship, first_item)
      ON CONFLICT DO NOTHING;
    END IF;

    idx := 1;
    FOR item_rec IN
      SELECT oi.id
      FROM public.order_items oi
      WHERE oi.order_id = rec.order_id
        AND oi.id IS DISTINCT FROM first_item
      ORDER BY oi.sort_order, oi.id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.order_shipment_items x WHERE x.order_item_id = item_rec.id
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.order_shipments (
        order_id, sort_order, packaging_kind, delivery_status, created_at, updated_at
      )
      VALUES (rec.order_id, idx, 'separate_item', 'pending', now(), now())
      RETURNING id INTO new_ship;

      INSERT INTO public.order_shipment_items (shipment_id, order_item_id)
      VALUES (new_ship, item_rec.id);

      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;

-- Attach at most ONE tracked label per shipment (newest wins). Extra legacy
-- duplicate labels stay with shipment_id NULL so the unique index can apply.
-- Each label is assigned to at most one shipment (prefer line match, then primary).
WITH candidates AS (
  SELECT
    osl.id AS label_id,
    s.id AS shipment_id,
    CASE
      WHEN s.packaging_kind = 'separate_item'
        AND EXISTS (
          SELECT 1
          FROM public.order_shipment_items si
          WHERE si.shipment_id = s.id
            AND si.order_item_id = osl.order_item_id
        )
        THEN 1
      WHEN s.packaging_kind = 'together' AND s.sort_order = 0 THEN 2
      WHEN s.packaging_kind = 'separate_item'
        AND osl.order_item_id IS NULL
        AND s.sort_order = 0
        THEN 3
      ELSE 9
    END AS match_rank,
    osl.created_at
  FROM public.order_shipments s
  JOIN public.order_shipping_labels osl
    ON osl.order_id = s.order_id
   AND osl.shipment_id IS NULL
   AND osl.tracking_number IS NOT NULL
   AND btrim(osl.tracking_number) <> ''
),
best_for_label AS (
  SELECT DISTINCT ON (label_id)
    label_id,
    shipment_id
  FROM candidates
  WHERE match_rank < 9
  ORDER BY label_id, match_rank ASC, created_at DESC NULLS LAST
),
best_for_shipment AS (
  SELECT DISTINCT ON (b.shipment_id)
    b.label_id,
    b.shipment_id
  FROM best_for_label b
  JOIN public.order_shipping_labels osl ON osl.id = b.label_id
  ORDER BY b.shipment_id, osl.created_at DESC NULLS LAST, b.label_id DESC
)
UPDATE public.order_shipping_labels osl
SET shipment_id = best_for_shipment.shipment_id
FROM best_for_shipment
WHERE osl.id = best_for_shipment.label_id;

-- Labels with order_item_id but no tracking: still link for PDF/history (not in unique index).
UPDATE public.order_shipping_labels osl
SET shipment_id = si.shipment_id
FROM public.order_shipment_items si
WHERE osl.order_item_id = si.order_item_id
  AND osl.shipment_id IS NULL
  AND (osl.tracking_number IS NULL OR btrim(osl.tracking_number) = '');

-- Remaining untracked labels on together orders → primary shipment.
UPDATE public.order_shipping_labels osl
SET shipment_id = s.id
FROM public.order_shipments s
WHERE osl.order_id = s.order_id
  AND osl.shipment_id IS NULL
  AND s.sort_order = 0
  AND (osl.tracking_number IS NULL OR btrim(osl.tracking_number) = '')
  AND s.id = (
    SELECT s2.id
    FROM public.order_shipments s2
    WHERE s2.order_id = osl.order_id
    ORDER BY s2.sort_order, s2.created_at
    LIMIT 1
  );

-- Copy shipment tracking from linked label when missing.
UPDATE public.order_shipments s
SET
  tracking_number = COALESCE(NULLIF(btrim(s.tracking_number), ''), lbl.tracking_number),
  tracking_carrier = COALESCE(NULLIF(btrim(s.tracking_carrier), ''), lbl.tracking_carrier),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (shipment_id)
    shipment_id,
    tracking_number,
    tracking_carrier
  FROM public.order_shipping_labels
  WHERE shipment_id IS NOT NULL
    AND tracking_number IS NOT NULL
    AND btrim(tracking_number) <> ''
  ORDER BY shipment_id, created_at DESC
) lbl
WHERE s.id = lbl.shipment_id
  AND (s.tracking_number IS NULL OR btrim(s.tracking_number) = '');

-- Hard invariant: at most one tracked marketplace label per shipment.
CREATE UNIQUE INDEX IF NOT EXISTS order_shipping_labels_one_tracked_per_shipment_uidx
  ON public.order_shipping_labels (shipment_id)
  WHERE shipment_id IS NOT NULL
    AND tracking_number IS NOT NULL
    AND btrim(tracking_number) <> '';

COMMENT ON COLUMN public.shipengine_label_purchase_locks.package_key IS
  'together (legacy one-box) or order_shipments.id (preferred). Also accepted: order_items.id from early separate packaging.';

ALTER TABLE public.order_shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_shipment_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.order_shipments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_shipments TO service_role;

GRANT SELECT ON public.order_shipment_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_shipment_items TO service_role;

DROP POLICY IF EXISTS "order_shipments_select_as_order_party" ON public.order_shipments;
CREATE POLICY "order_shipments_select_as_order_party"
  ON public.order_shipments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "order_shipment_items_select_as_order_party" ON public.order_shipment_items;
CREATE POLICY "order_shipment_items_select_as_order_party"
  ON public.order_shipment_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_shipments s
      JOIN public.orders o ON o.id = s.order_id
      WHERE s.id = shipment_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );
