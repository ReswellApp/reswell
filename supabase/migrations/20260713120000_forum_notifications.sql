-- Threads-only in-app notifications (replies, likes on forum content).

CREATE TABLE IF NOT EXISTS public.forum_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('thread_reply', 'comment_reply', 'thread_like', 'comment_like')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_notifications_user_created
  ON public.forum_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_notifications_user_unread
  ON public.forum_notifications(user_id, is_read, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_forum_notifications_user_thread
  ON public.forum_notifications(user_id, thread_id, created_at DESC);

ALTER TABLE public.forum_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_notifications_select_own" ON public.forum_notifications;
CREATE POLICY "forum_notifications_select_own" ON public.forum_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_notifications_update_own" ON public.forum_notifications;
CREATE POLICY "forum_notifications_update_own" ON public.forum_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_forum_comment_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_author uuid;
  parent_author uuid;
  thread_title text;
  actor_name text;
  is_opening_post boolean;
BEGIN
  is_opening_post := COALESCE((NEW.metadata ->> 'opening_post')::boolean, false);

  SELECT t.user_id, t.title
  INTO thread_author, thread_title
  FROM public.forum_threads t
  WHERE t.id = NEW.thread_id;

  SELECT p.display_name INTO actor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF NEW.parent_id IS NULL
    AND thread_author IS NOT NULL
    AND thread_author <> NEW.user_id
    AND NOT is_opening_post THEN
    INSERT INTO public.forum_notifications (user_id, type, actor_id, thread_id, comment_id, message)
    VALUES (
      thread_author,
      'thread_reply',
      NEW.user_id,
      NEW.thread_id,
      NEW.id,
      COALESCE(actor_name, 'Someone') || ' replied on ' || COALESCE(thread_title, 'your topic')
    );
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT c.user_id INTO parent_author
    FROM public.forum_comments c
    WHERE c.id = NEW.parent_id;

    IF parent_author IS NOT NULL AND parent_author <> NEW.user_id THEN
      INSERT INTO public.forum_notifications (user_id, type, actor_id, thread_id, comment_id, message)
      VALUES (
        parent_author,
        'comment_reply',
        NEW.user_id,
        NEW.thread_id,
        NEW.id,
        COALESCE(actor_name, 'Someone') || ' replied to your comment'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_comments_notify ON public.forum_comments;
CREATE TRIGGER forum_comments_notify
  AFTER INSERT ON public.forum_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_forum_comment_created();

CREATE OR REPLACE FUNCTION public.notify_forum_thread_liked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_author uuid;
  thread_title text;
  actor_name text;
BEGIN
  SELECT t.user_id, t.title
  INTO thread_author, thread_title
  FROM public.forum_threads t
  WHERE t.id = NEW.thread_id;

  IF thread_author IS NULL OR thread_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT p.display_name INTO actor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  INSERT INTO public.forum_notifications (user_id, type, actor_id, thread_id, message)
  VALUES (
    thread_author,
    'thread_like',
    NEW.user_id,
    NEW.thread_id,
    COALESCE(actor_name, 'Someone') || ' stoked your topic: ' || COALESCE(thread_title, 'your post')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_thread_likes_notify ON public.forum_thread_likes;
CREATE TRIGGER forum_thread_likes_notify
  AFTER INSERT ON public.forum_thread_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_forum_thread_liked();

CREATE OR REPLACE FUNCTION public.notify_forum_comment_liked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_author uuid;
  thread_id uuid;
  actor_name text;
BEGIN
  SELECT c.user_id, c.thread_id
  INTO comment_author, thread_id
  FROM public.forum_comments c
  WHERE c.id = NEW.comment_id;

  IF comment_author IS NULL OR comment_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT p.display_name INTO actor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  INSERT INTO public.forum_notifications (user_id, type, actor_id, thread_id, comment_id, message)
  VALUES (
    comment_author,
    'comment_like',
    NEW.user_id,
    thread_id,
    NEW.comment_id,
    COALESCE(actor_name, 'Someone') || ' stoked your comment'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_comment_likes_notify ON public.forum_comment_likes;
CREATE TRIGGER forum_comment_likes_notify
  AFTER INSERT ON public.forum_comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_forum_comment_liked();
