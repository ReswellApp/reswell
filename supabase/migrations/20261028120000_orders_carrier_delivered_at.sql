-- ShipEngine carrier delivery drives marketplace delivery + a 24h payout hold before wallet release.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier_delivered_at timestamptz;

COMMENT ON COLUMN public.orders.carrier_delivered_at IS
  'First timestamp when ShipEngine tracking reported delivery (actual_delivery_date or DE status). Payout auto-release runs 24h after this.';

ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_hold_reason_check;
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_hold_reason_check
  CHECK (
    hold_reason IS NULL
    OR hold_reason IN (
      'awaiting_shipment',
      'awaiting_delivery',
      'awaiting_manual_release',
      'awaiting_carrier_settlement',
      'awaiting_pickup'
    )
  );

COMMENT ON COLUMN public.payouts.hold_reason IS
  'awaiting_shipment: no tracking. awaiting_delivery: in transit. awaiting_carrier_settlement: carrier delivered; 24h hold before payout. awaiting_manual_release: legacy manual admin path. awaiting_pickup: local pickup.';

-- Backfill carrier_delivered_at from cached ShipEngine snapshots.
UPDATE public.orders o
SET
  carrier_delivered_at = COALESCE(
    NULLIF(trim(o.tracking_detail->>'actual_delivery_date'), '')::timestamptz,
    o.updated_at
  ),
  delivery_status = CASE
    WHEN o.delivery_status IN ('pending', 'shipped') THEN 'delivered'
    ELSE o.delivery_status
  END,
  updated_at = now()
WHERE o.fulfillment_method = 'shipping'
  AND o.status = 'confirmed'
  AND o.carrier_delivered_at IS NULL
  AND o.tracking_detail IS NOT NULL
  AND (
    upper(coalesce(o.tracking_detail->>'status_code', '')) = 'DE'
    OR NULLIF(trim(o.tracking_detail->>'actual_delivery_date'), '') IS NOT NULL
  );

-- Align payout holds for carrier-delivered orders still on hold.
UPDATE public.payouts p
SET
  status = 'held',
  hold_reason = 'awaiting_carrier_settlement',
  released_at = NULL,
  updated_at = now()
FROM public.orders o
WHERE p.order_id = o.id
  AND o.fulfillment_method = 'shipping'
  AND o.status = 'confirmed'
  AND o.carrier_delivered_at IS NOT NULL
  AND p.status IN ('held', 'pending')
  AND (
    p.status = 'held'
    OR p.released_at IS NULL
  );

-- Repair legacy pending rows missing released_at (pre-admin-release backfills).
UPDATE public.payouts p
SET
  status = 'held',
  hold_reason = CASE
    WHEN o.carrier_delivered_at IS NOT NULL THEN 'awaiting_carrier_settlement'
    WHEN o.delivery_status = 'shipped' THEN 'awaiting_delivery'
    WHEN o.delivery_status = 'delivered' THEN 'awaiting_manual_release'
    ELSE 'awaiting_shipment'
  END,
  released_at = NULL,
  updated_at = now()
FROM public.orders o
WHERE p.order_id = o.id
  AND o.fulfillment_method = 'shipping'
  AND o.status = 'confirmed'
  AND p.status = 'pending'
  AND p.released_at IS NULL;
