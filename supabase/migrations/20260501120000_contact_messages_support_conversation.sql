-- Link support tickets from Messages inbox to the member ↔ support DM thread.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS support_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contact_messages_support_conversation
  ON public.contact_messages (support_conversation_id)
  WHERE support_conversation_id IS NOT NULL;
