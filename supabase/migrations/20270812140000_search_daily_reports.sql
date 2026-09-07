-- Daily Gemini-authored search analytics reports for /admin/search-daily-report.
-- One row per Pacific calendar day. Cron + admin regenerate upsert on report_date.

CREATE TABLE IF NOT EXISTS public.search_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
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
  CONSTRAINT search_daily_reports_date_uidx UNIQUE (report_date),
  CONSTRAINT search_daily_reports_status_chk
    CHECK (status IN ('generating', 'complete', 'failed', 'empty'))
);

CREATE INDEX IF NOT EXISTS search_daily_reports_generated_at_idx
  ON public.search_daily_reports (generated_at DESC);

COMMENT ON TABLE public.search_daily_reports IS
  'Gemini daily briefings of marketplace search, dropdown picks, and zero-result demand for admin.';

ALTER TABLE public.search_daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_daily_reports_staff_select" ON public.search_daily_reports;
CREATE POLICY "search_daily_reports_staff_select"
  ON public.search_daily_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

-- Writes go through the service-role client (cron + admin generate).
DROP POLICY IF EXISTS "search_daily_reports_staff_write" ON public.search_daily_reports;
CREATE POLICY "search_daily_reports_staff_write"
  ON public.search_daily_reports FOR ALL
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
