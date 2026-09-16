-- Link live chat sessions to the canonical support_cases row.
ALTER TABLE public.live_chat_sessions
  ADD COLUMN IF NOT EXISTS support_case_id UUID REFERENCES public.support_cases(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS live_chat_sessions_support_case_id_key
  ON public.live_chat_sessions (support_case_id)
  WHERE support_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_case_escalation_scan
  ON public.live_chat_sessions (last_visitor_message_at)
  WHERE user_id IS NOT NULL
    AND support_case_id IS NULL
    AND contact_message_id IS NULL
    AND status IN ('open', 'assigned');
