-- Nested replies: parent_id NULL = top-level comment; set = reply to that comment (one level; app enforces reply-to-top-level only).
-- Run if forum_comments existed before parent_id was added.

ALTER TABLE public.forum_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_id ON public.forum_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_thread_top ON public.forum_comments(thread_id) WHERE parent_id IS NULL;
