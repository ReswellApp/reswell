-- Contact form submissions (from /contact page)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (anon or authenticated)
DROP POLICY IF EXISTS "contact_messages_insert_public" ON public.contact_messages;
CREATE POLICY "contact_messages_insert_public" ON public.contact_messages
  FOR INSERT
  WITH CHECK (true);

-- Only admins and employees can view
DROP POLICY IF EXISTS "contact_messages_select_admin" ON public.contact_messages;
CREATE POLICY "contact_messages_select_admin" ON public.contact_messages
  FOR SELECT
  USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );
