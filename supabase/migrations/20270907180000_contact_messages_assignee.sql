-- Staff assignment on general Help / contact tickets (matches order_support_requests).

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS assignee_admin_id uuid;

CREATE INDEX IF NOT EXISTS contact_messages_assignee_admin_id_idx
  ON public.contact_messages (assignee_admin_id)
  WHERE assignee_admin_id IS NOT NULL;

COMMENT ON COLUMN public.contact_messages.assignee_admin_id IS
  'Staff profile assigned to this general support ticket.';
