-- Staff heartbeat for live-chat "online" status. Visitors never write this table.
CREATE TABLE IF NOT EXISTS public.live_chat_agent_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Support',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_agent_presence_last_seen
  ON public.live_chat_agent_presence (last_seen_at DESC);

ALTER TABLE public.live_chat_agent_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_chat_agent_presence_staff_all" ON public.live_chat_agent_presence;
CREATE POLICY "live_chat_agent_presence_staff_all"
  ON public.live_chat_agent_presence
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());
