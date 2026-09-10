-- Staff replies were service-role-only. If that client is unavailable, the
-- insert is rejected by RLS and a later thread reload looks empty.
DROP POLICY IF EXISTS support_case_messages_insert_staff ON public.support_case_messages;
CREATE POLICY support_case_messages_insert_staff ON public.support_case_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_role IN ('agent', 'system')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS support_cases_update_staff ON public.support_cases;
CREATE POLICY support_cases_update_staff ON public.support_cases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
