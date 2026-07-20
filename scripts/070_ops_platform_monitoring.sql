-- Mirror of supabase/migrations/20270720120000_ops_platform_monitoring.sql
-- Platform ops monitoring: unified store for Vercel, Supabase, and app errors.

CREATE TABLE IF NOT EXISTS public.ops_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL UNIQUE,
  reference_code TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('vercel', 'supabase', 'client', 'server')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  stack_sample TEXT,
  category TEXT,
  path TEXT,
  environment TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count >= 0),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_url TEXT,
  release TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_groups_status_last_seen
  ON public.ops_groups (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_groups_source_last_seen
  ON public.ops_groups (source, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_groups_reference_code
  ON public.ops_groups (reference_code);

CREATE TABLE IF NOT EXISTS public.ops_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.ops_groups (id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('vercel', 'supabase', 'client', 'server')),
  external_id TEXT,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  url TEXT,
  user_agent TEXT,
  digest TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ops_signals_source_external_id_uidx
  ON public.ops_signals (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ops_signals_group_occurred
  ON public.ops_signals (group_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.ops_fix_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.ops_groups (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_fix_tickets_group
  ON public.ops_fix_tickets (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_fix_tickets_status
  ON public.ops_fix_tickets (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ops_ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('vercel', 'supabase', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
  range_hours NUMERIC,
  signals_ingested INTEGER NOT NULL DEFAULT 0,
  groups_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ops_ingest_runs_source_started
  ON public.ops_ingest_runs (source, started_at DESC);

ALTER TABLE public.ops_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_fix_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_ingest_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_or_employee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
  );
$$;

DROP POLICY IF EXISTS "ops_groups_select_staff" ON public.ops_groups;
CREATE POLICY "ops_groups_select_staff" ON public.ops_groups
  FOR SELECT
  USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "ops_groups_update_staff" ON public.ops_groups;
CREATE POLICY "ops_groups_update_staff" ON public.ops_groups
  FOR UPDATE
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "ops_signals_select_staff" ON public.ops_signals;
CREATE POLICY "ops_signals_select_staff" ON public.ops_signals
  FOR SELECT
  USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "ops_fix_tickets_select_staff" ON public.ops_fix_tickets;
CREATE POLICY "ops_fix_tickets_select_staff" ON public.ops_fix_tickets
  FOR SELECT
  USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "ops_fix_tickets_insert_staff" ON public.ops_fix_tickets;
CREATE POLICY "ops_fix_tickets_insert_staff" ON public.ops_fix_tickets
  FOR INSERT
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "ops_fix_tickets_update_staff" ON public.ops_fix_tickets;
CREATE POLICY "ops_fix_tickets_update_staff" ON public.ops_fix_tickets
  FOR UPDATE
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "ops_ingest_runs_select_staff" ON public.ops_ingest_runs;
CREATE POLICY "ops_ingest_runs_select_staff" ON public.ops_ingest_runs
  FOR SELECT
  USING (public.is_admin_or_employee());
