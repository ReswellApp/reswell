-- DB-backed URL redirects managed from the admin SEO panel and applied in middleware.
-- A row maps an exact incoming path (`from_path`) to a destination (`to_path`) with an HTTP
-- status. Enabled rows are readable by anon so edge middleware can resolve them; writes are
-- admin-only. Keep `from_path` normalized (leading slash, no query, no trailing slash except root).

CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path text NOT NULL,
  to_path text NOT NULL,
  status_code smallint NOT NULL DEFAULT 301,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  hits integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_redirects_from_leading_slash CHECK (from_path LIKE '/%'),
  CONSTRAINT seo_redirects_to_nonempty CHECK (char_length(trim(to_path)) > 0),
  CONSTRAINT seo_redirects_no_self_loop CHECK (from_path <> to_path),
  CONSTRAINT seo_redirects_status CHECK (status_code IN (301, 302, 307, 308)),
  CONSTRAINT seo_redirects_from_len CHECK (char_length(from_path) <= 2048),
  CONSTRAINT seo_redirects_to_len CHECK (char_length(to_path) <= 2048)
);

CREATE UNIQUE INDEX IF NOT EXISTS seo_redirects_from_path_key
  ON public.seo_redirects (from_path);

CREATE INDEX IF NOT EXISTS seo_redirects_enabled_idx
  ON public.seo_redirects (enabled)
  WHERE enabled = true;

COMMENT ON TABLE public.seo_redirects IS
  'Admin-managed 301/302 redirects applied by middleware. Enabled rows are anon-readable for edge lookup.';

DROP TRIGGER IF EXISTS seo_redirects_set_updated_at ON public.seo_redirects;
CREATE TRIGGER seo_redirects_set_updated_at
  BEFORE UPDATE ON public.seo_redirects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.seo_redirects ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated may read only ENABLED rows (middleware resolves redirects with the anon key).
DROP POLICY IF EXISTS "seo_redirects_select_enabled_public" ON public.seo_redirects;
CREATE POLICY "seo_redirects_select_enabled_public" ON public.seo_redirects
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

-- Staff (admins + employees) may read every row in the admin panel.
DROP POLICY IF EXISTS "seo_redirects_select_staff" ON public.seo_redirects;
CREATE POLICY "seo_redirects_select_staff" ON public.seo_redirects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "seo_redirects_insert_admin" ON public.seo_redirects;
CREATE POLICY "seo_redirects_insert_admin" ON public.seo_redirects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "seo_redirects_update_admin" ON public.seo_redirects;
CREATE POLICY "seo_redirects_update_admin" ON public.seo_redirects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "seo_redirects_delete_admin" ON public.seo_redirects;
CREATE POLICY "seo_redirects_delete_admin" ON public.seo_redirects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
