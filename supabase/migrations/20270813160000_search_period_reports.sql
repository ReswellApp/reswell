-- Monthly and all-time Gemini search reports for /admin/search-daily-report.
-- One row per (period_kind, period_key). Cron + admin regenerate upsert on that pair.

CREATE TABLE IF NOT EXISTS public.search_period_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_kind text NOT NULL,
  period_key text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  status text NOT NULL DEFAULT 'complete',
  from_iso timestamptz NOT NULL,
  to_iso timestamptz NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_period_reports_kind_key_uidx UNIQUE (period_kind, period_key),
  CONSTRAINT search_period_reports_kind_chk
    CHECK (period_kind IN ('month', 'all_time')),
  CONSTRAINT search_period_reports_status_chk
    CHECK (status IN ('generating', 'complete', 'failed', 'empty'))
);

CREATE INDEX IF NOT EXISTS search_period_reports_kind_generated_idx
  ON public.search_period_reports (period_kind, generated_at DESC);

COMMENT ON TABLE public.search_period_reports IS
  'Gemini monthly and all-time briefings of marketplace search demand for admin.';

ALTER TABLE public.search_period_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_period_reports_staff_select" ON public.search_period_reports;
CREATE POLICY "search_period_reports_staff_select"
  ON public.search_period_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "search_period_reports_staff_write" ON public.search_period_reports;
CREATE POLICY "search_period_reports_staff_write"
  ON public.search_period_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
