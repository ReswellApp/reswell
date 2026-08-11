-- Allow Reswell AI bot messages in live chat threads.

ALTER TABLE public.live_chat_messages
  DROP CONSTRAINT IF EXISTS live_chat_messages_sender_type_check;

ALTER TABLE public.live_chat_messages
  ADD CONSTRAINT live_chat_messages_sender_type_check
  CHECK (sender_type IN ('visitor', 'agent', 'system', 'bot'));
