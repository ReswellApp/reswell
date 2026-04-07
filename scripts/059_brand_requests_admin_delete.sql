-- Mirror of supabase/migrations/20260426120000_brand_requests_admin_delete.sql

DROP POLICY IF EXISTS "brand_requests_delete_admin" ON public.brand_requests;
CREATE POLICY "brand_requests_delete_admin" ON public.brand_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );
