-- Saved Gemini business-intelligence briefings for /admin/intelligence.
-- One row per (period_kind, period_key). Cron + admin regenerate upsert.

CREATE TABLE IF NOT EXISTS public.business_intelligence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_kind text NOT NULL,
  period_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
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
  CONSTRAINT business_intelligence_reports_period_uidx UNIQUE (period_kind, period_key),
  CONSTRAINT business_intelligence_reports_kind_chk
    CHECK (period_kind IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT business_intelligence_reports_status_chk
    CHECK (status IN ('generating', 'complete', 'failed', 'empty'))
);

CREATE INDEX IF NOT EXISTS business_intelligence_reports_generated_at_idx
  ON public.business_intelligence_reports (generated_at DESC);

CREATE INDEX IF NOT EXISTS business_intelligence_reports_kind_start_idx
  ON public.business_intelligence_reports (period_kind, period_start DESC);

COMMENT ON TABLE public.business_intelligence_reports IS
  'Gemini briefings of marketplace GMV, growth, traffic, and operating recommendations for admin.';

ALTER TABLE public.business_intelligence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_intelligence_reports_staff_select"
  ON public.business_intelligence_reports;
CREATE POLICY "business_intelligence_reports_staff_select"
  ON public.business_intelligence_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

-- Writes go through the service-role client (cron + admin generate).
DROP POLICY IF EXISTS "business_intelligence_reports_staff_write"
  ON public.business_intelligence_reports;
CREATE POLICY "business_intelligence_reports_staff_write"
  ON public.business_intelligence_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );
