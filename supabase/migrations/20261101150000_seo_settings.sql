-- Singleton settings row backing the admin "Crawling" panel: robots.txt overrides and extra
-- sitemap references. Code holds the base robots rules; these columns augment them. Read by the
-- service-role resolver (robots.ts), written only by admins.

CREATE TABLE IF NOT EXISTS public.seo_settings (
  id text PRIMARY KEY DEFAULT 'global',
  -- Global kill switch: when true, robots.txt disallows everything (use for staging).
  discourage_all_crawlers boolean NOT NULL DEFAULT false,
  -- Extra paths appended to the base Disallow / Allow lists for all crawlers.
  extra_disallow text[] NOT NULL DEFAULT '{}',
  extra_allow text[] NOT NULL DEFAULT '{}',
  -- Optional Crawl-delay (seconds). NULL omits the directive.
  crawl_delay integer,
  -- Additional sitemap URLs to advertise alongside the generated index.
  extra_sitemaps text[] NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_settings_singleton CHECK (id = 'global'),
  CONSTRAINT seo_settings_crawl_delay CHECK (crawl_delay IS NULL OR (crawl_delay >= 0 AND crawl_delay <= 60))
);

COMMENT ON TABLE public.seo_settings IS
  'Singleton (id=global) robots.txt + sitemap overrides for the admin Crawling panel.';

INSERT INTO public.seo_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS seo_settings_set_updated_at ON public.seo_settings;
CREATE TRIGGER seo_settings_set_updated_at
  BEFORE UPDATE ON public.seo_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

-- Staff may read in the admin panel; robots.ts reads via the service-role client (bypasses RLS).
DROP POLICY IF EXISTS "seo_settings_select_staff" ON public.seo_settings;
CREATE POLICY "seo_settings_select_staff" ON public.seo_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "seo_settings_update_admin" ON public.seo_settings;
CREATE POLICY "seo_settings_update_admin" ON public.seo_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "seo_settings_insert_admin" ON public.seo_settings;
CREATE POLICY "seo_settings_insert_admin" ON public.seo_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
