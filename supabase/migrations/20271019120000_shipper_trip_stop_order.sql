-- Drive order for a shipper trip. coastal_stops.sort_order stays south to north.
-- Existing Capitola–Bodega runs keep their stops. position is backfilled from
-- that south-to-north sort so those runs read the same way they do today.

BEGIN;

ALTER TABLE public.coastal_shipper_run_stops
  ADD COLUMN IF NOT EXISTS position integer;

UPDATE public.coastal_shipper_run_stops rs
SET position = s.sort_order
FROM public.coastal_stops s
WHERE rs.stop_id = s.id
  AND rs.position IS NULL;

UPDATE public.coastal_shipper_run_stops
SET position = 0
WHERE position IS NULL;

ALTER TABLE public.coastal_shipper_run_stops
  ALTER COLUMN position SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coastal_shipper_run_stops_run_position_idx
  ON public.coastal_shipper_run_stops (run_id, position);

COMMENT ON COLUMN public.coastal_shipper_run_stops.position IS
  'Drive order on this trip. 0 is the first city. Not the global south-to-north sort_order.';

COMMIT;
