-- Prevent duplicate cases when backfilling legacy tickets.
CREATE UNIQUE INDEX IF NOT EXISTS support_cases_order_support_request_uidx
  ON public.support_cases (order_support_request_id)
  WHERE order_support_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS support_cases_contact_message_uidx
  ON public.support_cases (contact_message_id)
  WHERE contact_message_id IS NOT NULL;

COMMENT ON TABLE public.support_cases IS
  'Canonical customer support cases. contact_messages and order_support_requests are sidecars only.';
