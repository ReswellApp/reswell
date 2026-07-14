-- Customer support portal: members can read their own tickets; logged-in contact form links account.
-- Mirror of supabase/migrations/20260713200000_contact_messages_user_portal.sql

DROP POLICY IF EXISTS "contact_messages_insert_contact_form" ON public.contact_messages;

CREATE POLICY "contact_messages_insert_contact_form" ON public.contact_messages
  FOR INSERT
  WITH CHECK (
    source = 'contact_form'
    AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "contact_messages_select_own" ON public.contact_messages;

CREATE POLICY "contact_messages_select_own" ON public.contact_messages
  FOR SELECT
  USING (
    user_id IS NOT NULL
    AND user_id = auth.uid()
  );

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id_created
  ON public.contact_messages (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
