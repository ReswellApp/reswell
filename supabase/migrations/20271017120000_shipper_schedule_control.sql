-- Shippers schedule their own trips. A null service_date repeats every week.
-- A date is that week only. Regions and exclusions decide where they drive.
-- Cancelled is a pickup the shipper called off before it was picked up.

BEGIN;

ALTER TABLE public.coastal_shipper_runs
  ADD COLUMN IF NOT EXISTS service_date date;

COMMENT ON COLUMN public.coastal_shipper_runs.service_date IS
  'Null repeats every week on day_of_week. A date is that calendar day only, America/Los_Angeles.';

ALTER TABLE public.coastal_shipper_runs
  DROP CONSTRAINT IF EXISTS coastal_shipper_runs_unique;

CREATE UNIQUE INDEX IF NOT EXISTS coastal_shipper_runs_weekly_unique
  ON public.coastal_shipper_runs (shipper_id, day_of_week, direction)
  WHERE service_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coastal_shipper_runs_dated_unique
  ON public.coastal_shipper_runs (shipper_id, service_date, direction)
  WHERE service_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.coastal_shipper_regions (
  shipper_id uuid NOT NULL REFERENCES public.coastal_shippers (id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES public.coastal_stops (id) ON DELETE RESTRICT,
  PRIMARY KEY (shipper_id, stop_id)
);

COMMENT ON TABLE public.coastal_shipper_regions IS
  'Towns this shipper will pick up and drop off. Addresses outside this span are not theirs.';

CREATE TABLE IF NOT EXISTS public.coastal_shipper_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id uuid NOT NULL REFERENCES public.coastal_shippers (id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coastal_shipper_exclusions_kind CHECK (kind IN ('area', 'address')),
  CONSTRAINT coastal_shipper_exclusions_label CHECK (char_length(btrim(label)) BETWEEN 2 AND 160)
);

COMMENT ON TABLE public.coastal_shipper_exclusions IS
  'An area or street this shipper will not pick up or drop off, even inside their regions.';

ALTER TABLE public.coastal_delivery_requests
  DROP CONSTRAINT IF EXISTS coastal_delivery_requests_status;

ALTER TABLE public.coastal_delivery_requests
  ADD CONSTRAINT coastal_delivery_requests_status
  CHECK (status IN ('waiting_for_run', 'picked_up', 'dropped_off', 'cancelled'));

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

  IF OLD.status = 'waiting_for_run' AND NEW.status NOT IN ('waiting_for_run', 'picked_up', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid handoff status change';
  END IF;
  IF OLD.status = 'cancelled' AND NEW.status NOT IN ('cancelled', 'waiting_for_run') THEN
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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coastal_shipper_regions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coastal_shipper_exclusions TO authenticated;

ALTER TABLE public.coastal_shipper_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coastal_shipper_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coastal_shipper_regions_admin_all ON public.coastal_shipper_regions;
CREATE POLICY coastal_shipper_regions_admin_all
  ON public.coastal_shipper_regions
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin IS TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin IS TRUE));

DROP POLICY IF EXISTS coastal_shipper_regions_own_all ON public.coastal_shipper_regions;
CREATE POLICY coastal_shipper_regions_own_all
  ON public.coastal_shipper_regions
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coastal_shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coastal_shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS coastal_shipper_exclusions_admin_all ON public.coastal_shipper_exclusions;
CREATE POLICY coastal_shipper_exclusions_admin_all
  ON public.coastal_shipper_exclusions
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin IS TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin IS TRUE));

DROP POLICY IF EXISTS coastal_shipper_exclusions_own_all ON public.coastal_shipper_exclusions;
CREATE POLICY coastal_shipper_exclusions_own_all
  ON public.coastal_shipper_exclusions
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coastal_shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coastal_shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS coastal_shipper_runs_own_insert ON public.coastal_shipper_runs;
CREATE POLICY coastal_shipper_runs_own_insert
  ON public.coastal_shipper_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.coastal_shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS coastal_shipper_runs_own_delete ON public.coastal_shipper_runs;
CREATE POLICY coastal_shipper_runs_own_delete
  ON public.coastal_shipper_runs
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coastal_shippers s WHERE s.id = shipper_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS coastal_shipper_run_stops_own_write ON public.coastal_shipper_run_stops;
CREATE POLICY coastal_shipper_run_stops_own_write
  ON public.coastal_shipper_run_stops
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coastal_shipper_runs r
      JOIN public.coastal_shippers s ON s.id = r.shipper_id
      WHERE r.id = run_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.coastal_shipper_runs r
      JOIN public.coastal_shippers s ON s.id = r.shipper_id
      WHERE r.id = run_id AND s.user_id = auth.uid()
    )
  );

COMMIT;
