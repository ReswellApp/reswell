-- Team-shared triage state for the Search analytics "Insights & recommended actions" panel.
-- One row per insight id; lets every admin/employee see the same done/snoozed/assigned state.

CREATE TABLE IF NOT EXISTS public.search_insight_actions (
  insight_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'open',
  snooze_until timestamptz,
  assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  due_date date,
  note text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_insight_actions_status_chk
    CHECK (status IN ('open', 'in_progress', 'snoozed', 'done', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS search_insight_actions_assignee_idx
  ON public.search_insight_actions (assignee_id);

CREATE INDEX IF NOT EXISTS search_insight_actions_status_idx
  ON public.search_insight_actions (status);

COMMENT ON TABLE public.search_insight_actions IS
  'Shared triage state for /admin/search-analytics insights: status, assignee, due date, and note keyed by the deterministic insight id.';

ALTER TABLE public.search_insight_actions ENABLE ROW LEVEL SECURITY;

-- Full access for staff (admins + employees); everyone else is denied.
DROP POLICY IF EXISTS "search_insight_actions_staff_all" ON public.search_insight_actions;
CREATE POLICY "search_insight_actions_staff_all"
  ON public.search_insight_actions FOR ALL
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
