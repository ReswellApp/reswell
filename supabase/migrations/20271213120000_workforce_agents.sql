-- Workforce agents: admin on/off registry + run history for Reswell growth/ops agents.

CREATE TABLE IF NOT EXISTS public.workforce_agents (
  id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_run_status text,
  last_run_summary text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_agents_last_run_status_check CHECK (
    last_run_status IS NULL
    OR last_run_status IN ('ok', 'error', 'skipped', 'idle')
  )
);

COMMENT ON TABLE public.workforce_agents IS
  'Per-agent enable flags and last-run snapshot for the admin Workforce Agents panel.';

CREATE TABLE IF NOT EXISTS public.workforce_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL REFERENCES public.workforce_agents (id) ON DELETE CASCADE,
  status text NOT NULL,
  summary text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_agent_runs_status_check CHECK (
    status IN ('ok', 'error', 'skipped')
  ),
  CONSTRAINT workforce_agent_runs_triggered_by_check CHECK (
    triggered_by IN ('manual', 'cron', 'system')
  )
);

CREATE INDEX IF NOT EXISTS workforce_agent_runs_agent_created_idx
  ON public.workforce_agent_runs (agent_id, created_at DESC);

COMMENT ON TABLE public.workforce_agent_runs IS
  'Append-only run log for workforce agents (cron or admin Run now).';

INSERT INTO public.workforce_agents (id, enabled) VALUES
  ('shop-scout', false),
  ('shop-mailer', false),
  ('fb-supply-copilot', false),
  ('meta-ads-writer', false),
  ('listing-completer', false),
  ('seller-reactivator', false),
  ('shopify-shop-closer', false),
  ('price-guide-ops', false),
  ('buyer-matchmaker', false),
  ('cs-escalation', false),
  ('content-seo', false),
  ('trust-fraud', false),
  ('weekly-pnl', false),
  ('local-dropoff', false)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS workforce_agents_set_updated_at ON public.workforce_agents;
CREATE TRIGGER workforce_agents_set_updated_at
  BEFORE UPDATE ON public.workforce_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workforce_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workforce_agents_select_admin" ON public.workforce_agents;
CREATE POLICY "workforce_agents_select_admin" ON public.workforce_agents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "workforce_agents_update_admin" ON public.workforce_agents;
CREATE POLICY "workforce_agents_update_admin" ON public.workforce_agents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "workforce_agents_insert_admin" ON public.workforce_agents;
CREATE POLICY "workforce_agents_insert_admin" ON public.workforce_agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "workforce_agent_runs_select_admin" ON public.workforce_agent_runs;
CREATE POLICY "workforce_agent_runs_select_admin" ON public.workforce_agent_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "workforce_agent_runs_insert_admin" ON public.workforce_agent_runs;
CREATE POLICY "workforce_agent_runs_insert_admin" ON public.workforce_agent_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

GRANT SELECT, INSERT, UPDATE ON public.workforce_agents TO authenticated;
GRANT SELECT, INSERT ON public.workforce_agent_runs TO authenticated;
