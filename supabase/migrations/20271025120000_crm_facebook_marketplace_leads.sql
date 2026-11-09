-- Facebook Marketplace leads on the existing CRM contact.
-- Staff paste a profile link and a message thread, then open both from the dashboard.

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS facebook_profile_url text,
  ADD COLUMN IF NOT EXISTS facebook_profile_id text,
  ADD COLUMN IF NOT EXISTS facebook_username text,
  ADD COLUMN IF NOT EXISTS facebook_thread_id text,
  ADD COLUMN IF NOT EXISTS facebook_thread_url text,
  ADD COLUMN IF NOT EXISTS facebook_display_name text;

COMMENT ON COLUMN public.crm_contacts.facebook_profile_url IS
  'Canonical Facebook profile URL captured from a pasted Marketplace lead.';
COMMENT ON COLUMN public.crm_contacts.facebook_profile_id IS
  'Numeric Facebook profile id when the pasted link includes one.';
COMMENT ON COLUMN public.crm_contacts.facebook_username IS
  'Facebook vanity username when the pasted link uses one.';
COMMENT ON COLUMN public.crm_contacts.facebook_thread_id IS
  'Facebook Marketplace / Messenger thread id so staff can reopen the chat.';
COMMENT ON COLUMN public.crm_contacts.facebook_thread_url IS
  'Direct https://www.facebook.com/messages/t/{id} link for that thread.';
COMMENT ON COLUMN public.crm_contacts.facebook_display_name IS
  'Name read from the profile URL or from public page metadata, when Facebook shares one.';

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_facebook_profile_id_uidx
  ON public.crm_contacts (facebook_profile_id)
  WHERE facebook_profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_facebook_thread_id_uidx
  ON public.crm_contacts (facebook_thread_id)
  WHERE facebook_thread_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_facebook_username_uidx
  ON public.crm_contacts (lower(facebook_username))
  WHERE facebook_username IS NOT NULL;
