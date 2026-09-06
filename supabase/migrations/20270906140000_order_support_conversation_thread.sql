-- Link order help / claims to the same support DM thread model as contact_messages.

ALTER TABLE public.order_support_requests
  ADD COLUMN IF NOT EXISTS support_conversation_id uuid;

CREATE INDEX IF NOT EXISTS order_support_requests_support_conversation_id_idx
  ON public.order_support_requests (support_conversation_id)
  WHERE support_conversation_id IS NOT NULL;

COMMENT ON COLUMN public.order_support_requests.support_conversation_id IS
  'Member ↔ Reswell support conversation for back-and-forth on this case (shown under Help, not marketplace Messages).';
