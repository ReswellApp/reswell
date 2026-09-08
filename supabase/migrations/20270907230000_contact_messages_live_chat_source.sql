-- Local/prod DBs that skipped 20270806160000 still reject source = 'live_chat'.
ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_source_check;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_source_check
  CHECK (source IN ('contact_form', 'messages_support', 'live_chat'));
