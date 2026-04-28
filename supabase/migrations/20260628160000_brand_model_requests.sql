-- User-submitted requests to add a surfboard model to an existing brand catalog (`brand_models`).

CREATE TABLE IF NOT EXISTS public.brand_model_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  requested_model_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_model_requests_model_name_nonempty CHECK (length(trim(requested_model_name)) > 0)
);

CREATE INDEX IF NOT EXISTS brand_model_requests_created_at_idx ON public.brand_model_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS brand_model_requests_user_id_idx ON public.brand_model_requests (user_id);
CREATE INDEX IF NOT EXISTS brand_model_requests_brand_id_idx ON public.brand_model_requests (brand_id);

ALTER TABLE public.brand_model_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_model_requests_insert_own" ON public.brand_model_requests;
CREATE POLICY "brand_model_requests_insert_own" ON public.brand_model_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_model_requests_select_own" ON public.brand_model_requests;
CREATE POLICY "brand_model_requests_select_own" ON public.brand_model_requests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "brand_model_requests_select_staff" ON public.brand_model_requests;
CREATE POLICY "brand_model_requests_select_staff" ON public.brand_model_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

COMMENT ON TABLE public.brand_model_requests IS 'Sell-flow submissions asking for a new row in public.brand_models for an existing brand.';
