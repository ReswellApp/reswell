-- Staff (admin / employee) can create, edit, and delete canned replies in-app.
-- Select policy already exists; this adds write policies so macros are not seed/SQL-only.

DROP POLICY IF EXISTS support_macros_insert_staff ON public.support_macros;
CREATE POLICY support_macros_insert_staff ON public.support_macros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS support_macros_update_staff ON public.support_macros;
CREATE POLICY support_macros_update_staff ON public.support_macros
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

DROP POLICY IF EXISTS support_macros_delete_staff ON public.support_macros;
CREATE POLICY support_macros_delete_staff ON public.support_macros
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
