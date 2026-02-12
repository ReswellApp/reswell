-- Allow users to read their own submitted reports (for dashboard "My reports").
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT
  USING (auth.uid() = reporter_id);
