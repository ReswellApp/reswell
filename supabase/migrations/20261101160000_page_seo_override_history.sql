-- Append-only change log for page SEO overrides. One row per save/reset so admins can review
-- past versions and restore one. Snapshot stores the override values applied at that moment.

CREATE TABLE IF NOT EXISTS public.page_seo_override_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  action text NOT NULL DEFAULT 'save' CHECK (action IN ('save', 'reset')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_seo_override_history_key_idx
  ON public.page_seo_override_history (page_key, created_at DESC);

COMMENT ON TABLE public.page_seo_override_history IS
  'Append-only history of admin SEO override saves/resets for review and restore.';

ALTER TABLE public.page_seo_override_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_seo_history_select_staff" ON public.page_seo_override_history;
CREATE POLICY "page_seo_history_select_staff" ON public.page_seo_override_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "page_seo_history_insert_admin" ON public.page_seo_override_history;
CREATE POLICY "page_seo_history_insert_admin" ON public.page_seo_override_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
