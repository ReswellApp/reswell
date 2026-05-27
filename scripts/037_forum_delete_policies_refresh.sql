-- Refresh forum delete policies (safe to re-run).
-- Run in Supabase SQL editor if thread/comment deletes fail with permission errors.

DROP POLICY IF EXISTS "forum_threads_delete_own" ON public.forum_threads;

DROP POLICY IF EXISTS "forum_threads_delete_admin" ON public.forum_threads;
CREATE POLICY "forum_threads_delete_admin" ON public.forum_threads
  FOR DELETE USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

DROP POLICY IF EXISTS "forum_comments_delete_own" ON public.forum_comments;
CREATE POLICY "forum_comments_delete_own" ON public.forum_comments
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_comments_delete_admin" ON public.forum_comments;
CREATE POLICY "forum_comments_delete_admin" ON public.forum_comments
  FOR DELETE USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);
