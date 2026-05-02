-- When true and published, post appears on `/blog` index. Published + false = direct URL only ("hidden").

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS listed_on_blog boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS blog_posts_public_list_listed_idx
  ON public.blog_posts (published DESC, listed_on_blog DESC, sort_order DESC, published_at DESC)
  WHERE published = true AND listed_on_blog = true;
