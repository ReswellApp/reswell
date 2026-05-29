-- CRM upgrades: contact tags (many-to-many), brand attachment on board interests.
-- Owner/assignment reuses the existing crm_contacts.assigned_to column (no schema change).

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate'
    CHECK (color IN ('slate', 'teal', 'sky', 'violet', 'amber', 'rose', 'emerald', 'indigo', 'orange', 'pink')),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_tags_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_tags_name_lower_uidx ON public.crm_tags (lower(trim(name)));

COMMENT ON TABLE public.crm_tags IS 'Reusable CRM contact tags (label + color). Staff-only via RLS.';

CREATE TABLE IF NOT EXISTS public.crm_contact_tags (
  contact_id uuid NOT NULL REFERENCES public.crm_contacts (id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS crm_contact_tags_tag_id_idx ON public.crm_contact_tags (tag_id);

COMMENT ON TABLE public.crm_contact_tags IS 'Join table linking CRM contacts to tags (many-to-many).';

-- ---------------------------------------------------------------------------
-- Brand attachment on board interests
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_board_interests
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_board_interests_brand_id_idx
  ON public.crm_board_interests (brand_id) WHERE brand_id IS NOT NULL;

COMMENT ON COLUMN public.crm_board_interests.brand_id IS
  'Directory brand when the interest is a whole brand (interest_type = catalog_brand).';

-- Widen the interest_type whitelist to include catalog_brand and require brand_id for it.
ALTER TABLE public.crm_board_interests
  DROP CONSTRAINT IF EXISTS crm_board_interests_interest_type_check;
ALTER TABLE public.crm_board_interests
  ADD CONSTRAINT crm_board_interests_interest_type_check
    CHECK (interest_type IN ('listing', 'catalog_model', 'catalog_brand', 'custom'));

ALTER TABLE public.crm_board_interests
  DROP CONSTRAINT IF EXISTS crm_board_interests_catalog_brand_required;
ALTER TABLE public.crm_board_interests
  ADD CONSTRAINT crm_board_interests_catalog_brand_required
    CHECK (interest_type <> 'catalog_brand' OR brand_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS crm_tags_updated_at ON public.crm_tags;
CREATE TRIGGER crm_tags_updated_at
  BEFORE UPDATE ON public.crm_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_contacts_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: admin + employee staff only (reuses public.crm_is_staff()).
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contact_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_tags_staff_all" ON public.crm_tags;
CREATE POLICY "crm_tags_staff_all" ON public.crm_tags
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());

DROP POLICY IF EXISTS "crm_contact_tags_staff_all" ON public.crm_contact_tags;
CREATE POLICY "crm_contact_tags_staff_all" ON public.crm_contact_tags
  FOR ALL
  TO authenticated
  USING (public.crm_is_staff())
  WITH CHECK (public.crm_is_staff());
