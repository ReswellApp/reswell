-- Built-in admin CRM: contacts (profile-linked or external), board interests, interaction log.

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'external'
    CHECK (source IN ('profile', 'external')),
  status text NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead', 'prospect', 'active', 'customer', 'inactive')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  notes text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contacts_profile_id_unique UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS crm_contacts_status_idx ON public.crm_contacts (status);
CREATE INDEX IF NOT EXISTS crm_contacts_priority_idx ON public.crm_contacts (priority);
CREATE INDEX IF NOT EXISTS crm_contacts_last_contacted_at_idx ON public.crm_contacts (last_contacted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS crm_contacts_next_follow_up_at_idx ON public.crm_contacts (next_follow_up_at ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS crm_contacts_profile_id_idx ON public.crm_contacts (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_contacts_email_idx ON public.crm_contacts (lower(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE public.crm_contacts IS
  'Admin CRM contacts — linked Reswell profiles or external leads. Staff-only via RLS.';

CREATE TABLE IF NOT EXISTS public.crm_board_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts (id) ON DELETE CASCADE,
  interest_type text NOT NULL
    CHECK (interest_type IN ('listing', 'catalog_model', 'custom')),
  listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  brand_model_id uuid REFERENCES public.brand_models (id) ON DELETE SET NULL,
  custom_description text,
  brand text,
  model text,
  dimensions text,
  budget_min numeric(10, 2),
  budget_max numeric(10, 2),
  status text NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'contacted', 'matched', 'fulfilled', 'lost')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_board_interests_listing_required
    CHECK (interest_type <> 'listing' OR listing_id IS NOT NULL),
  CONSTRAINT crm_board_interests_catalog_required
    CHECK (interest_type <> 'catalog_model' OR brand_model_id IS NOT NULL),
  CONSTRAINT crm_board_interests_custom_required
    CHECK (interest_type <> 'custom' OR custom_description IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS crm_board_interests_contact_id_idx ON public.crm_board_interests (contact_id);
CREATE INDEX IF NOT EXISTS crm_board_interests_status_idx ON public.crm_board_interests (status);
CREATE INDEX IF NOT EXISTS crm_board_interests_listing_id_idx ON public.crm_board_interests (listing_id) WHERE listing_id IS NOT NULL;

COMMENT ON TABLE public.crm_board_interests IS
  'Surfboard interests tracked per CRM contact — listing, catalog model, or free-form.';

CREATE TABLE IF NOT EXISTS public.crm_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts (id) ON DELETE CASCADE,
  interaction_type text NOT NULL
    CHECK (interaction_type IN ('call', 'email', 'text', 'in_person', 'note', 'other')),
  subject text,
  notes text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_interactions_contact_id_idx ON public.crm_interactions (contact_id);
CREATE INDEX IF NOT EXISTS crm_interactions_created_at_idx ON public.crm_interactions (created_at DESC);

COMMENT ON TABLE public.crm_interactions IS
  'Contact touchpoint log; inserts update crm_contacts.last_contacted_at via trigger.';

-- Keep last_contacted_at in sync when staff log interactions.
CREATE OR REPLACE FUNCTION public.crm_touch_last_contacted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_contacts
  SET
    last_contacted_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.contact_id
    AND (last_contacted_at IS NULL OR last_contacted_at < NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_interactions_touch_last_contacted ON public.crm_interactions;
CREATE TRIGGER crm_interactions_touch_last_contacted
  AFTER INSERT ON public.crm_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_touch_last_contacted();

CREATE OR REPLACE FUNCTION public.crm_contacts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_contacts_set_updated_at();

DROP TRIGGER IF EXISTS crm_board_interests_updated_at ON public.crm_board_interests;
CREATE TRIGGER crm_board_interests_updated_at
  BEFORE UPDATE ON public.crm_board_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_contacts_set_updated_at();

-- RLS: admin + employee staff only.
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_board_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.crm_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
  );
$$;

DROP POLICY IF EXISTS "crm_contacts_staff_all" ON public.crm_contacts;
CREATE POLICY "crm_contacts_staff_all" ON public.crm_contacts
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());

DROP POLICY IF EXISTS "crm_board_interests_staff_all" ON public.crm_board_interests;
CREATE POLICY "crm_board_interests_staff_all" ON public.crm_board_interests
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());

DROP POLICY IF EXISTS "crm_interactions_staff_all" ON public.crm_interactions;
CREATE POLICY "crm_interactions_staff_all" ON public.crm_interactions
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());
