-- Link approved catalog brands to the UGC row that created them (optional FK).

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS brand_request_id uuid REFERENCES public.brand_requests (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS brands_brand_request_id_key
  ON public.brands (brand_request_id)
  WHERE brand_request_id IS NOT NULL;

COMMENT ON COLUMN public.brands.brand_request_id IS 'Set when this brand is created from a brand_requests row; becomes NULL if that request is deleted after migration.';

ALTER TABLE public.brand_requests
  ADD COLUMN IF NOT EXISTS created_brand_slug text;

COMMENT ON COLUMN public.brand_requests.created_brand_slug IS 'Slug of the brands row after admin approval (if any).';

-- Admins may update requests (status, created_brand_slug) for the approval workflow.
DROP POLICY IF EXISTS "brand_requests_update_admin" ON public.brand_requests;
CREATE POLICY "brand_requests_update_admin" ON public.brand_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );
