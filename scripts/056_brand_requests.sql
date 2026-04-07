-- Mirror of supabase/migrations/20260423120000_brand_requests.sql

CREATE TABLE IF NOT EXISTS public.brand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  requested_name text NOT NULL,
  website_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_requests_created_at_idx ON public.brand_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS brand_requests_user_id_idx ON public.brand_requests (user_id);

ALTER TABLE public.brand_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_requests_insert_own" ON public.brand_requests;
CREATE POLICY "brand_requests_insert_own" ON public.brand_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_requests_select_own" ON public.brand_requests;
CREATE POLICY "brand_requests_select_own" ON public.brand_requests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_requests_select_staff" ON public.brand_requests;
CREATE POLICY "brand_requests_select_staff" ON public.brand_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

COMMENT ON TABLE public.brand_requests IS 'Sell-flow submissions asking for a new row in public.brands.';
