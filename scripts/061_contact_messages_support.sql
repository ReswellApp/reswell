-- Support triage fields for /admin/contact-messages (ticket workflow, notes)
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS support_status TEXT NOT NULL DEFAULT 'new'
    CHECK (support_status IN ('new', 'triaged', 'ticket_created', 'resolved'));

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS ticket_url TEXT;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.set_contact_messages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_messages_set_updated_at ON public.contact_messages;
CREATE TRIGGER contact_messages_set_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_messages_updated_at();

-- Admins and employees can update triage fields
DROP POLICY IF EXISTS "contact_messages_update_admin" ON public.contact_messages;
CREATE POLICY "contact_messages_update_admin" ON public.contact_messages
  FOR UPDATE
  USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );
