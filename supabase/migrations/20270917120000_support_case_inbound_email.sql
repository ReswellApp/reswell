-- Idempotent inbound customer email → support_case_messages.
-- Webhook: POST /api/webhooks/inbound-email (Resend Receiving or generic JSON).

ALTER TABLE public.support_case_messages
  ADD COLUMN IF NOT EXISTS inbound_email_id text;

CREATE UNIQUE INDEX IF NOT EXISTS support_case_messages_inbound_email_id_uidx
  ON public.support_case_messages (inbound_email_id)
  WHERE inbound_email_id IS NOT NULL;

COMMENT ON COLUMN public.support_case_messages.inbound_email_id IS
  'Provider message id (Resend email_id or generic fallback) for inbound email dedupe.';
