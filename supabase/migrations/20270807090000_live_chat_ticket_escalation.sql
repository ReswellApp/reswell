-- Live chat ticket escalation: track agent response time so unanswered
-- signed-in chats can be auto-escalated to support tickets after 24h.

ALTER TABLE public.live_chat_sessions
  ADD COLUMN IF NOT EXISTS last_agent_message_at TIMESTAMPTZ;

-- Keep last_agent_message_at current alongside the existing touch trigger.
CREATE OR REPLACE FUNCTION public.touch_live_chat_session_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_chat_sessions
  SET
    last_message_at = NEW.created_at,
    last_visitor_message_at = CASE
      WHEN NEW.sender_type = 'visitor' THEN NEW.created_at
      ELSE last_visitor_message_at
    END,
    last_agent_message_at = CASE
      WHEN NEW.sender_type = 'agent' THEN NEW.created_at
      ELSE last_agent_message_at
    END,
    updated_at = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

-- Backfill from existing agent messages.
UPDATE public.live_chat_sessions s
SET last_agent_message_at = agent_latest.max_created_at
FROM (
  SELECT session_id, MAX(created_at) AS max_created_at
  FROM public.live_chat_messages
  WHERE sender_type = 'agent'
  GROUP BY session_id
) agent_latest
WHERE s.id = agent_latest.session_id
  AND s.last_agent_message_at IS NULL;

-- Narrow index for the hourly escalation scan (signed-in, no ticket yet, still open).
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_escalation_scan
  ON public.live_chat_sessions (last_visitor_message_at)
  WHERE user_id IS NOT NULL
    AND contact_message_id IS NULL
    AND status IN ('open', 'assigned');
