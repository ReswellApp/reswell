-- Allow marketplace admins to update any forum thread (run if 032 was applied before this policy existed).

DROP POLICY IF EXISTS "forum_threads_update_admin" ON public.forum_threads;
CREATE POLICY "forum_threads_update_admin" ON public.forum_threads
  FOR UPDATE
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true)
  WITH CHECK ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);
