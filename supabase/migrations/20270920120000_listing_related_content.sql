-- Manual related content on listing PDPs: curated blogs and other listings.

BEGIN;

CREATE TABLE IF NOT EXISTS public.listing_related_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  related_listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_related_content_kind_check
    CHECK (kind IN ('blog', 'listing')),
  CONSTRAINT listing_related_content_target_check
    CHECK (
      (kind = 'blog' AND blog_post_id IS NOT NULL AND related_listing_id IS NULL)
      OR
      (kind = 'listing' AND related_listing_id IS NOT NULL AND blog_post_id IS NULL)
    ),
  CONSTRAINT listing_related_content_not_self
    CHECK (related_listing_id IS NULL OR related_listing_id <> listing_id)
);

COMMENT ON TABLE public.listing_related_content IS
  'Manually curated blog posts and listings shown as related content on a listing PDP.';
COMMENT ON COLUMN public.listing_related_content.listing_id IS
  'The listing whose /l page should show this related item.';
COMMENT ON COLUMN public.listing_related_content.kind IS
  'blog or listing — exactly one target FK is set.';

CREATE UNIQUE INDEX IF NOT EXISTS listing_related_content_listing_blog_uidx
  ON public.listing_related_content (listing_id, blog_post_id)
  WHERE blog_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listing_related_content_listing_listing_uidx
  ON public.listing_related_content (listing_id, related_listing_id)
  WHERE related_listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_related_content_listing_sort_idx
  ON public.listing_related_content (listing_id, sort_order, created_at);

DROP TRIGGER IF EXISTS listing_related_content_set_updated_at ON public.listing_related_content;
CREATE TRIGGER listing_related_content_set_updated_at
  BEFORE UPDATE ON public.listing_related_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.listing_related_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_related_content_select_public ON public.listing_related_content;
CREATE POLICY listing_related_content_select_public
  ON public.listing_related_content
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS listing_related_content_admin_insert ON public.listing_related_content;
CREATE POLICY listing_related_content_admin_insert
  ON public.listing_related_content
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS listing_related_content_admin_update ON public.listing_related_content;
CREATE POLICY listing_related_content_admin_update
  ON public.listing_related_content
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS listing_related_content_admin_delete ON public.listing_related_content;
CREATE POLICY listing_related_content_admin_delete
  ON public.listing_related_content
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

COMMIT;
