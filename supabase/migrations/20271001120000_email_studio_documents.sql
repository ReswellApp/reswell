-- Internal Klaviyo email projects and reusable templates for /admin/email-studio.

CREATE TABLE IF NOT EXISTS public.email_studio_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('project', 'template')),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  preview_text text NOT NULL DEFAULT '',
  flow_name text NOT NULL DEFAULT '',
  flow_id text NOT NULL DEFAULT '',
  trigger_metric text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  document jsonb NOT NULL,
  klaviyo_template_id text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_studio_documents_kind_updated_idx
  ON public.email_studio_documents (kind, updated_at DESC);

ALTER TABLE public.email_studio_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_studio_documents_select_staff ON public.email_studio_documents;
CREATE POLICY email_studio_documents_select_staff ON public.email_studio_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_documents_insert_staff ON public.email_studio_documents;
CREATE POLICY email_studio_documents_insert_staff ON public.email_studio_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_documents_update_staff ON public.email_studio_documents;
CREATE POLICY email_studio_documents_update_staff ON public.email_studio_documents
  FOR UPDATE
  TO authenticated
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

DROP POLICY IF EXISTS email_studio_documents_delete_staff ON public.email_studio_documents;
CREATE POLICY email_studio_documents_delete_staff ON public.email_studio_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
