-- Shipper dashboard: handoff statuses, stop coordinates, and residential snapshots.
-- Shippers may read and update only their own schedule and the jobs on their runs.
-- Admins keep full access. Buyers and other staff do not.

BEGIN;

ALTER TABLE public.coastal_stops
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.coastal_stops.latitude IS
  'Fixed map latitude for this corridor stop. Not live GPS.';
COMMENT ON COLUMN public.coastal_stops.longitude IS
  'Fixed map longitude for this corridor stop. Not live GPS.';

UPDATE public.coastal_stops SET latitude = 36.9710, longitude = -121.9533 WHERE slug = 'capitola' AND latitude IS NULL;
UPDATE public.coastal_stops SET latitude = 36.9647, longitude = -122.0016 WHERE slug = 'santa-cruz' AND latitude IS NULL;
UPDATE public.coastal_stops SET latitude = 37.4636, longitude = -122.4286 WHERE slug = 'half-moon-bay' AND latitude IS NULL;
UPDATE public.coastal_stops SET latitude = 37.6138, longitude = -122.4950 WHERE slug = 'pacifica' AND latitude IS NULL;
UPDATE public.coastal_stops SET latitude = 37.7594, longitude = -122.5107 WHERE slug = 'san-francisco' AND latitude IS NULL;
UPDATE public.coastal_stops SET latitude = 37.9094, longitude = -122.6864 WHERE slug = 'bolinas' AND latitude IS NULL;
UPDATE public.coastal_stops SET latitude = 38.3332, longitude = -123.0486 WHERE slug = 'bodega-bay' AND latitude IS NULL;

ALTER TABLE public.coastal_delivery_requests
  ADD COLUMN IF NOT EXISTS pickup_address jsonb,
  ADD COLUMN IF NOT EXISTS dropoff_address jsonb;

COMMENT ON COLUMN public.coastal_delivery_requests.pickup_address IS
  'Snapshot of a residential pickup already stored on the listing. Null when the map should use the corridor pickup stop.';
COMMENT ON COLUMN public.coastal_delivery_requests.dropoff_address IS
  'Snapshot of a residential drop-off already stored on the order shipping address. Null when the map should use the corridor drop-off stop.';

ALTER TABLE public.coastal_delivery_requests
  DROP CONSTRAINT IF EXISTS coastal_delivery_requests_status;

ALTER TABLE public.coastal_delivery_requests
  ADD CONSTRAINT coastal_delivery_requests_status
  CHECK (status IN ('waiting_for_run', 'picked_up', 'dropped_off'));

COMMENT ON COLUMN public.coastal_delivery_requests.status IS
  'waiting_for_run, then picked_up, then dropped_off. A shipper can step back one status from the run sheet.';

CREATE INDEX IF NOT EXISTS coastal_delivery_requests_matched_run_idx
  ON public.coastal_delivery_requests (matched_run_id)
  WHERE matched_run_id IS NOT NULL;

-- Direct client updates may change handoff status only, and only one step at a time.
-- Service role (auth.uid() is null) and admins can still write snapshots and route fields.
CREATE OR REPLACE FUNCTION public.coastal_delivery_requests_guard_shipper_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.is_admin INTO actor_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF actor_is_admin IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.pickup_stop_id IS DISTINCT FROM OLD.pickup_stop_id
     OR NEW.seller_origin_label IS DISTINCT FROM OLD.seller_origin_label
     OR NEW.dropoff_stop_id IS DISTINCT FROM OLD.dropoff_stop_id
     OR NEW.shipper_id IS DISTINCT FROM OLD.shipper_id
     OR NEW.matched_run_id IS DISTINCT FROM OLD.matched_run_id
     OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
     OR NEW.dropoff_address IS DISTINCT FROM OLD.dropoff_address
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Shippers can only update the handoff status';
  END IF;

  IF OLD.status = 'waiting_for_run' AND NEW.status NOT IN ('waiting_for_run', 'picked_up') THEN
    RAISE EXCEPTION 'Invalid handoff status change';
  END IF;
  IF OLD.status = 'picked_up' AND NEW.status NOT IN ('picked_up', 'dropped_off', 'waiting_for_run') THEN
    RAISE EXCEPTION 'Invalid handoff status change';
  END IF;
  IF OLD.status = 'dropped_off' AND NEW.status NOT IN ('dropped_off', 'picked_up') THEN
    RAISE EXCEPTION 'Invalid handoff status change';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coastal_delivery_requests_guard_shipper_update ON public.coastal_delivery_requests;
CREATE TRIGGER coastal_delivery_requests_guard_shipper_update
  BEFORE UPDATE ON public.coastal_delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.coastal_delivery_requests_guard_shipper_update();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coastal_stops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coastal_shippers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coastal_shipper_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coastal_shipper_run_stops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coastal_delivery_requests TO authenticated;

DROP POLICY IF EXISTS coastal_stops_shipper_select ON public.coastal_stops;
CREATE POLICY coastal_stops_shipper_select
  ON public.coastal_stops
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coastal_shippers s WHERE s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coastal_shippers_own_select ON public.coastal_shippers;
CREATE POLICY coastal_shippers_own_select
  ON public.coastal_shippers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS coastal_shippers_own_update ON public.coastal_shippers;
CREATE POLICY coastal_shippers_own_update
  ON public.coastal_shippers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS coastal_shipper_runs_own_select ON public.coastal_shipper_runs;
CREATE POLICY coastal_shipper_runs_own_select
  ON public.coastal_shipper_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coastal_shippers s
      WHERE s.id = shipper_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coastal_shipper_runs_own_update ON public.coastal_shipper_runs;
CREATE POLICY coastal_shipper_runs_own_update
  ON public.coastal_shipper_runs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coastal_shippers s
      WHERE s.id = shipper_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coastal_shippers s
      WHERE s.id = shipper_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coastal_shipper_run_stops_own_select ON public.coastal_shipper_run_stops;
CREATE POLICY coastal_shipper_run_stops_own_select
  ON public.coastal_shipper_run_stops
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coastal_shipper_runs r
      JOIN public.coastal_shippers s ON s.id = r.shipper_id
      WHERE r.id = run_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coastal_delivery_requests_shipper_select ON public.coastal_delivery_requests;
CREATE POLICY coastal_delivery_requests_shipper_select
  ON public.coastal_delivery_requests
  FOR SELECT
  TO authenticated
  USING (
    shipper_id = (SELECT s.id FROM public.coastal_shippers s WHERE s.user_id = auth.uid())
    OR matched_run_id IN (
      SELECT r.id
      FROM public.coastal_shipper_runs r
      JOIN public.coastal_shippers s ON s.id = r.shipper_id
      WHERE s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coastal_delivery_requests_shipper_update ON public.coastal_delivery_requests;
CREATE POLICY coastal_delivery_requests_shipper_update
  ON public.coastal_delivery_requests
  FOR UPDATE
  TO authenticated
  USING (
    shipper_id = (SELECT s.id FROM public.coastal_shippers s WHERE s.user_id = auth.uid())
    OR matched_run_id IN (
      SELECT r.id
      FROM public.coastal_shipper_runs r
      JOIN public.coastal_shippers s ON s.id = r.shipper_id
      WHERE s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    shipper_id = (SELECT s.id FROM public.coastal_shippers s WHERE s.user_id = auth.uid())
    OR matched_run_id IN (
      SELECT r.id
      FROM public.coastal_shipper_runs r
      JOIN public.coastal_shippers s ON s.id = r.shipper_id
      WHERE s.user_id = auth.uid()
    )
  );

COMMIT;
