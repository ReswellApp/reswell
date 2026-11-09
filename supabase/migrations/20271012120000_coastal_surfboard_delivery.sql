-- Admin-only draft: coastal surfboard hand delivery (Santa Cruz ↔ North Coast).
-- Not used by public checkout. Buyers do not see these tables.
-- Stops are ordered south → north. Capitola is south of Santa Cruz.
-- Seeded corridor: Capitola, Santa Cruz, Half Moon Bay, Pacifica,
-- San Francisco, Bolinas, Bodega Bay.

BEGIN;

CREATE TABLE IF NOT EXISTS public.coastal_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coastal_stops_slug_nonempty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT coastal_stops_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT coastal_stops_sort_order_unique UNIQUE (sort_order)
);

COMMENT ON TABLE public.coastal_stops IS
  'Fixed hand-delivery stops on the Santa Cruz to North Coast corridor. sort_order increases south to north. No live GPS.';

CREATE TABLE IF NOT EXISTS public.coastal_shippers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone text,
  notes text,
  schedule_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coastal_shippers_name_nonempty CHECK (char_length(trim(display_name)) > 0)
);

COMMENT ON TABLE public.coastal_shippers IS
  'Coastal hand-delivery drivers. Instant join in the admin draft; schedule starts off. Not a public onboarding flow.';
COMMENT ON COLUMN public.coastal_shippers.schedule_enabled IS
  'Whole weekly schedule. When false, none of this shipper''s runs match.';

CREATE TABLE IF NOT EXISTS public.coastal_shipper_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id uuid NOT NULL REFERENCES public.coastal_shippers (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  direction text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coastal_shipper_runs_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT coastal_shipper_runs_direction CHECK (direction IN ('northbound', 'southbound')),
  CONSTRAINT coastal_shipper_runs_unique UNIQUE (shipper_id, day_of_week, direction)
);

COMMENT ON TABLE public.coastal_shipper_runs IS
  'Weekly run slot. day_of_week uses 0 = Sunday through 6 = Saturday, America/Los_Angeles. Direction is along coastal_stops.sort_order.';
COMMENT ON COLUMN public.coastal_shipper_runs.enabled IS
  'Per-run switch. A disabled run does not match even when the shipper schedule is on.';

CREATE TABLE IF NOT EXISTS public.coastal_shipper_run_stops (
  run_id uuid NOT NULL REFERENCES public.coastal_shipper_runs (id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES public.coastal_stops (id) ON DELETE RESTRICT,
  PRIMARY KEY (run_id, stop_id)
);

COMMENT ON TABLE public.coastal_shipper_run_stops IS
  'Stops this weekly run covers. Matching requires both the pickup and drop-off stops, in direction order.';

CREATE TABLE IF NOT EXISTS public.coastal_delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings (id) ON DELETE CASCADE,
  pickup_stop_id uuid NOT NULL REFERENCES public.coastal_stops (id) ON DELETE RESTRICT,
  seller_origin_label text,
  dropoff_stop_id uuid NOT NULL REFERENCES public.coastal_stops (id) ON DELETE RESTRICT,
  shipper_id uuid REFERENCES public.coastal_shippers (id) ON DELETE SET NULL,
  matched_run_id uuid REFERENCES public.coastal_shipper_runs (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting_for_run',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coastal_delivery_requests_status CHECK (status IN ('waiting_for_run')),
  CONSTRAINT coastal_delivery_requests_distinct_stops CHECK (pickup_stop_id <> dropoff_stop_id)
);

COMMENT ON TABLE public.coastal_delivery_requests IS
  'Admin-preview buyer choice of white-glove coastal delivery on one listing. No charge. Not part of checkout.';
COMMENT ON COLUMN public.coastal_delivery_requests.seller_origin_label IS
  'Optional note for where the seller hands the board off. Routing uses pickup_stop_id, not this label.';
COMMENT ON COLUMN public.coastal_delivery_requests.status IS
  'waiting_for_run until a later live product assigns a driver on a calendar date.';

CREATE INDEX IF NOT EXISTS coastal_stops_active_sort_idx
  ON public.coastal_stops (active, sort_order);

CREATE INDEX IF NOT EXISTS coastal_shipper_runs_shipper_idx
  ON public.coastal_shipper_runs (shipper_id);

CREATE INDEX IF NOT EXISTS coastal_delivery_requests_shipper_idx
  ON public.coastal_delivery_requests (shipper_id)
  WHERE shipper_id IS NOT NULL;

DROP TRIGGER IF EXISTS coastal_stops_set_updated_at ON public.coastal_stops;
CREATE TRIGGER coastal_stops_set_updated_at
  BEFORE UPDATE ON public.coastal_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS coastal_shippers_set_updated_at ON public.coastal_shippers;
CREATE TRIGGER coastal_shippers_set_updated_at
  BEFORE UPDATE ON public.coastal_shippers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS coastal_shipper_runs_set_updated_at ON public.coastal_shipper_runs;
CREATE TRIGGER coastal_shipper_runs_set_updated_at
  BEFORE UPDATE ON public.coastal_shipper_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS coastal_delivery_requests_set_updated_at ON public.coastal_delivery_requests;
CREATE TRIGGER coastal_delivery_requests_set_updated_at
  BEFORE UPDATE ON public.coastal_delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.coastal_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coastal_shippers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coastal_shipper_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coastal_shipper_run_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coastal_delivery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coastal_stops_admin_all ON public.coastal_stops;
CREATE POLICY coastal_stops_admin_all
  ON public.coastal_stops
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS coastal_shippers_admin_all ON public.coastal_shippers;
CREATE POLICY coastal_shippers_admin_all
  ON public.coastal_shippers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS coastal_shipper_runs_admin_all ON public.coastal_shipper_runs;
CREATE POLICY coastal_shipper_runs_admin_all
  ON public.coastal_shipper_runs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS coastal_shipper_run_stops_admin_all ON public.coastal_shipper_run_stops;
CREATE POLICY coastal_shipper_run_stops_admin_all
  ON public.coastal_shipper_run_stops
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS coastal_delivery_requests_admin_all ON public.coastal_delivery_requests;
CREATE POLICY coastal_delivery_requests_admin_all
  ON public.coastal_delivery_requests
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

INSERT INTO public.coastal_stops (id, slug, name, sort_order)
VALUES
  ('b7c1a001-0001-4000-8000-000000000001', 'capitola', 'Capitola', 10),
  ('b7c1a001-0001-4000-8000-000000000002', 'santa-cruz', 'Santa Cruz', 20),
  ('b7c1a001-0001-4000-8000-000000000003', 'half-moon-bay', 'Half Moon Bay', 30),
  ('b7c1a001-0001-4000-8000-000000000004', 'pacifica', 'Pacifica', 40),
  ('b7c1a001-0001-4000-8000-000000000005', 'san-francisco', 'San Francisco', 50),
  ('b7c1a001-0001-4000-8000-000000000006', 'bolinas', 'Bolinas', 60),
  ('b7c1a001-0001-4000-8000-000000000007', 'bodega-bay', 'Bodega Bay', 70)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
