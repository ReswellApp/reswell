-- Latest Cursor Cloud Agent run attached to an internal Reswell ticket.

ALTER TABLE public.reswell_tickets
  ADD COLUMN IF NOT EXISTS cursor_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS cursor_agent_url TEXT,
  ADD COLUMN IF NOT EXISTS cursor_agent_status TEXT
    CHECK (
      cursor_agent_status IS NULL
      OR cursor_agent_status IN ('ACTIVE', 'IDLE', 'ARCHIVED')
    ),
  ADD COLUMN IF NOT EXISTS cursor_run_id TEXT,
  ADD COLUMN IF NOT EXISTS cursor_run_status TEXT
    CHECK (
      cursor_run_status IS NULL
      OR cursor_run_status IN (
        'CREATING',
        'RUNNING',
        'FINISHED',
        'ERROR',
        'CANCELLED',
        'EXPIRED'
      )
    ),
  ADD COLUMN IF NOT EXISTS cursor_pr_url TEXT,
  ADD COLUMN IF NOT EXISTS cursor_last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reswell_tickets_cursor_agent
  ON public.reswell_tickets (cursor_agent_id)
  WHERE cursor_agent_id IS NOT NULL;

COMMENT ON COLUMN public.reswell_tickets.cursor_agent_id IS
  'Latest Cursor Cloud Agent id (bc-…) launched from this ticket.';
COMMENT ON COLUMN public.reswell_tickets.cursor_agent_url IS
  'Public Cursor agent URL for staff to open the run.';
COMMENT ON COLUMN public.reswell_tickets.cursor_pr_url IS
  'Pull request opened by the latest Cursor agent, when one exists.';
