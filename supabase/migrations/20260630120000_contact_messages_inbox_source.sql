-- Support inbox: distinguish website contact vs in-app Messages tickets; optional subject and thread link.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'contact_form'
  CHECK (source IN ('contact_form', 'messages_support'));

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS subject TEXT;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS related_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Tighten INSERT so customers cannot forge in-app tickets for other users.
DROP POLICY IF EXISTS "contact_messages_insert_public" ON public.contact_messages;

CREATE POLICY "contact_messages_insert_contact_form" ON public.contact_messages
  FOR INSERT
  WITH CHECK (
    source = 'contact_form'
    AND user_id IS NULL
  );

CREATE POLICY "contact_messages_insert_messages_support" ON public.contact_messages
  FOR INSERT
  WITH CHECK (
    source = 'messages_support'
    AND user_id IS NOT NULL
    AND user_id = auth.uid()
  );
