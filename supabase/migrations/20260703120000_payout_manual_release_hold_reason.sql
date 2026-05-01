-- Payout stays held until an admin explicitly releases earnings (buyer confirmation only marks delivered).
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_hold_reason_check;
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_hold_reason_check
  CHECK (
    hold_reason IS NULL
    OR hold_reason IN (
      'awaiting_shipment',
      'awaiting_delivery',
      'awaiting_manual_release',
      'awaiting_pickup'
    )
  );

COMMENT ON COLUMN public.payouts.hold_reason IS
  'awaiting_shipment: no tracking. awaiting_delivery: in transit / not yet verified delivered. awaiting_manual_release: buyer verified receipt; funds released by admin. awaiting_pickup: local pickup.';
