-- Community forum threads: posts, comments, likes (run in Supabase SQL editor)
-- After running: Dashboard → Project Settings → API → click "Reload schema" so PostgREST picks up new tables.

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_id ON public.forum_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_thread_top ON public.forum_comments(thread_id) WHERE parent_id IS NULL;

CREATE TABLE IF NOT EXISTS public.forum_thread_likes (
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.forum_comment_likes (
  comment_id UUID NOT NULL REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_updated_at ON public.forum_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_thread_id ON public.forum_comments(thread_id, created_at);

CREATE OR REPLACE FUNCTION public.forum_touch_thread_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forum_threads SET updated_at = NOW() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_comments_touch_thread ON public.forum_comments;
CREATE TRIGGER forum_comments_touch_thread
  AFTER INSERT ON public.forum_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_touch_thread_on_comment();

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_thread_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_threads_select_public" ON public.forum_threads;
CREATE POLICY "forum_threads_select_public" ON public.forum_threads FOR SELECT USING (true);

DROP POLICY IF EXISTS "forum_threads_insert_auth" ON public.forum_threads;
CREATE POLICY "forum_threads_insert_auth" ON public.forum_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_threads_update_own" ON public.forum_threads;
CREATE POLICY "forum_threads_update_own" ON public.forum_threads
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_threads_update_admin" ON public.forum_threads;
CREATE POLICY "forum_threads_update_admin" ON public.forum_threads
  FOR UPDATE
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true)
  WITH CHECK ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

DROP POLICY IF EXISTS "forum_threads_delete_own" ON public.forum_threads;

DROP POLICY IF EXISTS "forum_comments_select_public" ON public.forum_comments;
CREATE POLICY "forum_comments_select_public" ON public.forum_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "forum_comments_insert_auth" ON public.forum_comments;
CREATE POLICY "forum_comments_insert_auth" ON public.forum_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_comments_update_own" ON public.forum_comments;
CREATE POLICY "forum_comments_update_own" ON public.forum_comments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_comments_delete_own" ON public.forum_comments;
CREATE POLICY "forum_comments_delete_own" ON public.forum_comments
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_thread_likes_select_public" ON public.forum_thread_likes;
CREATE POLICY "forum_thread_likes_select_public" ON public.forum_thread_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "forum_thread_likes_insert_own" ON public.forum_thread_likes;
CREATE POLICY "forum_thread_likes_insert_own" ON public.forum_thread_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_thread_likes_delete_own" ON public.forum_thread_likes;
CREATE POLICY "forum_thread_likes_delete_own" ON public.forum_thread_likes
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_comment_likes_select_public" ON public.forum_comment_likes;
CREATE POLICY "forum_comment_likes_select_public" ON public.forum_comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "forum_comment_likes_insert_own" ON public.forum_comment_likes;
CREATE POLICY "forum_comment_likes_insert_own" ON public.forum_comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_comment_likes_delete_own" ON public.forum_comment_likes;
CREATE POLICY "forum_comment_likes_delete_own" ON public.forum_comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Thread delete: admins only (authors cannot remove the whole thread)
DROP POLICY IF EXISTS "forum_threads_delete_admin" ON public.forum_threads;
CREATE POLICY "forum_threads_delete_admin" ON public.forum_threads
  FOR DELETE USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

DROP POLICY IF EXISTS "forum_comments_delete_admin" ON public.forum_comments;
CREATE POLICY "forum_comments_delete_admin" ON public.forum_comments
  FOR DELETE USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

-- Seed first thread (author = marketplace admin if present)
DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower('haydensbsb@gmail.com') LIMIT 1;
  IF uid IS NOT NULL THEN
    INSERT INTO public.forum_threads (user_id, title, slug, body)
    VALUES (uid, 'New Board Stoke Thread', 'new-board-stoke-thread', '')
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;
