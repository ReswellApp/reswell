-- Accounts granted a dropoff location can open /dashboard/dropoff-location.
-- Admin does not grant the link by itself. One grant per account.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dropoff_location_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  dropoff_location_id uuid NOT NULL REFERENCES public.dropoff_locations (id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dropoff_location_grants IS
  'One row lets that account open /dashboard/dropoff-location for a single dropoff site.';

CREATE INDEX IF NOT EXISTS dropoff_location_grants_location_idx
  ON public.dropoff_location_grants (dropoff_location_id);

ALTER TABLE public.dropoff_location_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dropoff_location_grants_own_select ON public.dropoff_location_grants;
CREATE POLICY dropoff_location_grants_own_select
  ON public.dropoff_location_grants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.dropoff_location_grants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dropoff_location_grants TO service_role;

COMMIT;
