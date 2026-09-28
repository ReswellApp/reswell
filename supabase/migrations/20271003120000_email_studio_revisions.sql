-- Versioned editing, optimistic concurrency, Klaviyo sync state, and AI proposals.

ALTER TABLE public.email_studio_documents
  ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS change_source text NOT NULL DEFAULT 'system'
    CHECK (change_source IN ('human', 'assistant', 'restore', 'system')),
  ADD COLUMN IF NOT EXISTS change_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS change_commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS klaviyo_synced_revision integer,
  ADD COLUMN IF NOT EXISTS klaviyo_content_checksum text,
  ADD COLUMN IF NOT EXISTS klaviyo_synced_at timestamptz;

ALTER TABLE public.email_studio_flows
  ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS change_source text NOT NULL DEFAULT 'system'
    CHECK (change_source IN ('human', 'assistant', 'restore', 'system')),
  ADD COLUMN IF NOT EXISTS change_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS change_commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS klaviyo_synced_revision integer,
  ADD COLUMN IF NOT EXISTS klaviyo_content_checksum text,
  ADD COLUMN IF NOT EXISTS klaviyo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS klaviyo_replaced_flow_id text,
  ADD COLUMN IF NOT EXISTS klaviyo_replaced_flow_status text;

CREATE TABLE IF NOT EXISTS public.email_studio_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('email', 'flow')),
  scope_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  schema_version smallint NOT NULL CHECK (schema_version > 0),
  snapshot jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('human', 'assistant', 'restore', 'system')),
  summary text NOT NULL DEFAULT '',
  commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_id, revision)
);

CREATE INDEX IF NOT EXISTS email_studio_revisions_scope_idx
  ON public.email_studio_revisions (scope, scope_id, revision DESC);

ALTER TABLE public.email_studio_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_studio_revisions_select_staff ON public.email_studio_revisions;
CREATE POLICY email_studio_revisions_select_staff ON public.email_studio_revisions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_revisions_insert_staff ON public.email_studio_revisions;
CREATE POLICY email_studio_revisions_insert_staff ON public.email_studio_revisions
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

CREATE TABLE IF NOT EXISTS public.email_studio_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('email', 'flow')),
  scope_id uuid NOT NULL,
  base_revision integer NOT NULL CHECK (base_revision > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applying', 'accepted', 'rejected', 'superseded')),
  summary text NOT NULL,
  assistant_message text NOT NULL DEFAULT '',
  commands jsonb NOT NULL,
  created_by uuid NOT NULL,
  resolved_by uuid,
  claimed_at timestamptz,
  accepted_revision integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS email_studio_proposals_scope_idx
  ON public.email_studio_proposals (scope, scope_id, created_at DESC);

ALTER TABLE public.email_studio_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_studio_proposals_select_staff ON public.email_studio_proposals;
CREATE POLICY email_studio_proposals_select_staff ON public.email_studio_proposals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_proposals_insert_staff ON public.email_studio_proposals;
CREATE POLICY email_studio_proposals_insert_staff ON public.email_studio_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_proposals_update_staff ON public.email_studio_proposals;
CREATE POLICY email_studio_proposals_update_staff ON public.email_studio_proposals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

CREATE OR REPLACE FUNCTION public.bump_email_studio_document_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(
    NEW.kind,
    NEW.name,
    NEW.subject,
    NEW.preview_text,
    NEW.flow_name,
    NEW.flow_id,
    NEW.trigger_metric,
    NEW.notes,
    NEW.document,
    NEW.schema_version
  ) IS DISTINCT FROM ROW(
    OLD.kind,
    OLD.name,
    OLD.subject,
    OLD.preview_text,
    OLD.flow_name,
    OLD.flow_id,
    OLD.trigger_metric,
    OLD.notes,
    OLD.document,
    OLD.schema_version
  ) THEN
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_email_studio_document_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.revision IS DISTINCT FROM OLD.revision THEN
    INSERT INTO public.email_studio_revisions (
      scope,
      scope_id,
      revision,
      schema_version,
      snapshot,
      source,
      summary,
      commands,
      created_by
    )
    VALUES (
      'email',
      NEW.id,
      NEW.revision,
      NEW.schema_version,
      jsonb_build_object(
        'name', NEW.name,
        'subject', NEW.subject,
        'previewText', NEW.preview_text,
        'flowName', NEW.flow_name,
        'flowId', NEW.flow_id,
        'triggerMetric', NEW.trigger_metric,
        'notes', NEW.notes,
        'document', NEW.document
      ),
      NEW.change_source,
      NEW.change_summary,
      NEW.change_commands,
      COALESCE(NEW.updated_by, NEW.created_by)
    )
    ON CONFLICT (scope, scope_id, revision) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_email_studio_flow_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(NEW.name, NEW.notes, NEW.definition, NEW.schema_version)
    IS DISTINCT FROM ROW(OLD.name, OLD.notes, OLD.definition, OLD.schema_version) THEN
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_email_studio_flow_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.revision IS DISTINCT FROM OLD.revision THEN
    INSERT INTO public.email_studio_revisions (
      scope,
      scope_id,
      revision,
      schema_version,
      snapshot,
      source,
      summary,
      commands,
      created_by
    )
    VALUES (
      'flow',
      NEW.id,
      NEW.revision,
      NEW.schema_version,
      jsonb_build_object(
        'name', NEW.name,
        'notes', NEW.notes,
        'definition', NEW.definition
      ),
      NEW.change_source,
      NEW.change_summary,
      NEW.change_commands,
      COALESCE(NEW.updated_by, NEW.created_by)
    )
    ON CONFLICT (scope, scope_id, revision) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_studio_documents_bump_revision ON public.email_studio_documents;
CREATE TRIGGER email_studio_documents_bump_revision
  BEFORE UPDATE ON public.email_studio_documents
  FOR EACH ROW EXECUTE FUNCTION public.bump_email_studio_document_revision();

DROP TRIGGER IF EXISTS email_studio_documents_capture_revision ON public.email_studio_documents;
CREATE TRIGGER email_studio_documents_capture_revision
  AFTER INSERT OR UPDATE ON public.email_studio_documents
  FOR EACH ROW EXECUTE FUNCTION public.capture_email_studio_document_revision();

DROP TRIGGER IF EXISTS email_studio_flows_bump_revision ON public.email_studio_flows;
CREATE TRIGGER email_studio_flows_bump_revision
  BEFORE UPDATE ON public.email_studio_flows
  FOR EACH ROW EXECUTE FUNCTION public.bump_email_studio_flow_revision();

DROP TRIGGER IF EXISTS email_studio_flows_capture_revision ON public.email_studio_flows;
CREATE TRIGGER email_studio_flows_capture_revision
  AFTER INSERT OR UPDATE ON public.email_studio_flows
  FOR EACH ROW EXECUTE FUNCTION public.capture_email_studio_flow_revision();

INSERT INTO public.email_studio_revisions (
  scope,
  scope_id,
  revision,
  schema_version,
  snapshot,
  source,
  summary,
  commands,
  created_by,
  created_at
)
SELECT
  'email',
  id,
  revision,
  schema_version,
  jsonb_build_object(
    'name', name,
    'subject', subject,
    'previewText', preview_text,
    'flowName', flow_name,
    'flowId', flow_id,
    'triggerMetric', trigger_metric,
    'notes', notes,
    'document', document
  ),
  'system',
  'Initial version',
  '[]'::jsonb,
  COALESCE(updated_by, created_by),
  updated_at
FROM public.email_studio_documents
ON CONFLICT (scope, scope_id, revision) DO NOTHING;

INSERT INTO public.email_studio_revisions (
  scope,
  scope_id,
  revision,
  schema_version,
  snapshot,
  source,
  summary,
  commands,
  created_by,
  created_at
)
SELECT
  'flow',
  id,
  revision,
  schema_version,
  jsonb_build_object(
    'name', name,
    'notes', notes,
    'definition', definition
  ),
  'system',
  'Initial version',
  '[]'::jsonb,
  COALESCE(updated_by, created_by),
  updated_at
FROM public.email_studio_flows
ON CONFLICT (scope, scope_id, revision) DO NOTHING;
