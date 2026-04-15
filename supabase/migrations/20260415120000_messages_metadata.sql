-- Structured payloads for system-style thread messages (e.g. order placed).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN public.messages.metadata IS
  'Optional structured payload for special message types (e.g. order_placed). Plain content remains for accessibility and integrations.';
