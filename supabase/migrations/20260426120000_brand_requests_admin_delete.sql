-- Allow admins to remove a brand_requests row after it has been migrated into public.brands.

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
