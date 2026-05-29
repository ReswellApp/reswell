-- Centralized, editable SEO overrides for the curated set of "pages that matter".
-- Each row is keyed by a stable `page_key` from `lib/seo/managed-pages.ts`. Code holds the
-- defaults; a row here overrides them field-by-field (NULL = fall back to the page default).
-- Reads on public pages go through the service-role resolver; direct table access is staff-only.

CREATE TABLE IF NOT EXISTS public.page_seo_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  -- Text metadata
  title text,
  description text,
  keywords text[],
  canonical_url text,
  -- Indexing controls (NULL = inherit the page default)
  robots_index boolean,
  robots_follow boolean,
  -- Open Graph
  og_title text,
  og_description text,
  og_image_url text,
  og_type text CHECK (og_type IS NULL OR og_type IN ('website', 'article')),
  -- Twitter / X card
  twitter_card text CHECK (twitter_card IS NULL OR twitter_card IN ('summary', 'summary_large_image')),
  twitter_title text,
  twitter_description text,
  twitter_image_url text,
  -- Optional custom JSON-LD structured data injected into the page head
  structured_data jsonb,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_seo_overrides_page_key_nonempty CHECK (char_length(trim(page_key)) > 0),
  CONSTRAINT page_seo_overrides_title_len CHECK (title IS NULL OR char_length(title) <= 300),
  CONSTRAINT page_seo_overrides_description_len CHECK (description IS NULL OR char_length(description) <= 600),
  CONSTRAINT page_seo_overrides_og_title_len CHECK (og_title IS NULL OR char_length(og_title) <= 300),
  CONSTRAINT page_seo_overrides_og_description_len CHECK (og_description IS NULL OR char_length(og_description) <= 600),
  CONSTRAINT page_seo_overrides_twitter_title_len CHECK (twitter_title IS NULL OR char_length(twitter_title) <= 300),
  CONSTRAINT page_seo_overrides_twitter_description_len CHECK (twitter_description IS NULL OR char_length(twitter_description) <= 600)
);

CREATE UNIQUE INDEX IF NOT EXISTS page_seo_overrides_page_key_key
  ON public.page_seo_overrides (page_key);

COMMENT ON TABLE public.page_seo_overrides IS
  'Editable per-page SEO overrides (admin SEO panel). NULL columns inherit code defaults from lib/seo/managed-pages.ts.';

DROP TRIGGER IF EXISTS page_seo_overrides_set_updated_at ON public.page_seo_overrides;
CREATE TRIGGER page_seo_overrides_set_updated_at
  BEFORE UPDATE ON public.page_seo_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.page_seo_overrides ENABLE ROW LEVEL SECURITY;

-- Staff (admins + employees) may read overrides in the admin panel; the public resolver
-- uses the service-role client and bypasses RLS, so no anon read policy is needed.
DROP POLICY IF EXISTS "page_seo_overrides_select_staff" ON public.page_seo_overrides;
CREATE POLICY "page_seo_overrides_select_staff" ON public.page_seo_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

-- Only full admins may create / edit / remove overrides.
DROP POLICY IF EXISTS "page_seo_overrides_insert_admin" ON public.page_seo_overrides;
CREATE POLICY "page_seo_overrides_insert_admin" ON public.page_seo_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "page_seo_overrides_update_admin" ON public.page_seo_overrides;
CREATE POLICY "page_seo_overrides_update_admin" ON public.page_seo_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "page_seo_overrides_delete_admin" ON public.page_seo_overrides;
CREATE POLICY "page_seo_overrides_delete_admin" ON public.page_seo_overrides
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
