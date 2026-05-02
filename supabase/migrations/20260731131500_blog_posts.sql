-- Editorial / marketing blog posts (Field Notes CMS). Published rows are readable by anyone;
-- drafts and edits are constrained to admins. Sort order drives the `/blog` index.

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  deck text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT 'Reswell',
  published_at date NOT NULL DEFAULT CURRENT_DATE,
  read_minutes integer NOT NULL DEFAULT 5,
  tag text NOT NULL DEFAULT 'News',
  cover_image_url text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  seo_description text,
  og_image_url text,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_slug_lower CHECK (slug = lower(slug)),
  CONSTRAINT blog_posts_slug_nonempty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT blog_posts_read_minutes_check CHECK (read_minutes >= 1 AND read_minutes <= 480)
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_key ON public.blog_posts (slug);

CREATE INDEX IF NOT EXISTS blog_posts_public_list_idx
  ON public.blog_posts (published DESC, sort_order DESC, published_at DESC)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS blog_posts_sort_idx
  ON public.blog_posts (sort_order DESC, created_at DESC);

DROP TRIGGER IF EXISTS blog_posts_set_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_posts_select_public_or_admin" ON public.blog_posts;
CREATE POLICY "blog_posts_select_public_or_admin" ON public.blog_posts
  FOR SELECT
  USING (
    published = true
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "blog_posts_insert_admin" ON public.blog_posts;
CREATE POLICY "blog_posts_insert_admin" ON public.blog_posts FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "blog_posts_update_admin" ON public.blog_posts;
CREATE POLICY "blog_posts_update_admin" ON public.blog_posts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "blog_posts_delete_admin" ON public.blog_posts;
CREATE POLICY "blog_posts_delete_admin" ON public.blog_posts FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
