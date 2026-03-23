-- Run if you already applied 032: authors can no longer delete whole threads—only is_admin.

DROP POLICY IF EXISTS "forum_threads_delete_own" ON public.forum_threads;

DROP POLICY IF EXISTS "forum_threads_delete_admin" ON public.forum_threads;
CREATE POLICY "forum_threads_delete_admin" ON public.forum_threads
  FOR DELETE USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);
