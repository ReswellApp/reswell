-- Speed up cron that links guest contact_messages to member accounts by email.
-- Mirror of supabase/migrations/20260713210000_contact_messages_unlinked_index.sql

CREATE INDEX IF NOT EXISTS idx_contact_messages_unlinked_created
  ON public.contact_messages (created_at ASC)
  WHERE user_id IS NULL;
