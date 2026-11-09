-- ShipEngine branded tracking portal URL for the tracking number currently on the order.
-- Recreated when the tracking number changes; ignored when the numbers do not match.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branded_tracking_url text,
  ADD COLUMN IF NOT EXISTS branded_tracking_number text;

COMMENT ON COLUMN public.orders.branded_tracking_url IS
  'https://track.shipengine.com page for branded_tracking_number (Reswell logo theme).';

COMMENT ON COLUMN public.orders.branded_tracking_number IS
  'Tracking number the branded_tracking_url was created for. Do not use the URL when this differs from tracking_number.';
