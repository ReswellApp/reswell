-- Live chat support: separate from marketplace messages/conversations.

-- Extend contact_messages source for signed-in live chat tickets.
ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_source_check;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_source_check
  CHECK (source IN ('contact_form', 'messages_support', 'live_chat'));

CREATE TABLE IF NOT EXISTS public.live_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  visitor_token TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL DEFAULT 'Guest',
  visitor_email TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'resolved', 'closed')),
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_message_id UUID REFERENCES public.contact_messages(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  last_visitor_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_status_last_message
  ON public.live_chat_sessions (status, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_visitor_token
  ON public.live_chat_sessions (visitor_token);

CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_user_id
  ON public.live_chat_sessions (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_assigned_agent
  ON public.live_chat_sessions (assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_chat_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'agent', 'system')),
  sender_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_session_created
  ON public.live_chat_messages (session_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.set_live_chat_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_chat_sessions_set_updated_at ON public.live_chat_sessions;
CREATE TRIGGER live_chat_sessions_set_updated_at
  BEFORE UPDATE ON public.live_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_live_chat_sessions_updated_at();

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
    updated_at = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_chat_messages_touch_session ON public.live_chat_messages;
CREATE TRIGGER live_chat_messages_touch_session
  AFTER INSERT ON public.live_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_live_chat_session_on_message();

ALTER TABLE public.live_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_chat_sessions_staff_all" ON public.live_chat_sessions;
CREATE POLICY "live_chat_sessions_staff_all" ON public.live_chat_sessions
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());

DROP POLICY IF EXISTS "live_chat_messages_staff_all" ON public.live_chat_messages;
CREATE POLICY "live_chat_messages_staff_all" ON public.live_chat_messages
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());

-- Realtime for admin inbox + thread updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_chat_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
  END IF;
END $$;

ALTER TABLE public.live_chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
