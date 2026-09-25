-- Klaviyo flows authored in /admin/email-studio, plus the assistant transcript.

CREATE TABLE IF NOT EXISTS public.email_studio_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text NOT NULL DEFAULT '',
  definition jsonb NOT NULL,
  klaviyo_flow_id text,
  klaviyo_status text NOT NULL DEFAULT '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_studio_flows_updated_idx
  ON public.email_studio_flows (updated_at DESC);

ALTER TABLE public.email_studio_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_studio_flows_select_staff ON public.email_studio_flows;
CREATE POLICY email_studio_flows_select_staff ON public.email_studio_flows
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_flows_insert_staff ON public.email_studio_flows;
CREATE POLICY email_studio_flows_insert_staff ON public.email_studio_flows
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_flows_update_staff ON public.email_studio_flows;
CREATE POLICY email_studio_flows_update_staff ON public.email_studio_flows
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

DROP POLICY IF EXISTS email_studio_flows_delete_staff ON public.email_studio_flows;
CREATE POLICY email_studio_flows_delete_staff ON public.email_studio_flows
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

CREATE TABLE IF NOT EXISTS public.email_studio_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('email', 'flow')),
  scope_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_studio_messages_scope_idx
  ON public.email_studio_messages (scope, scope_id, created_at);

ALTER TABLE public.email_studio_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_studio_messages_select_staff ON public.email_studio_messages;
CREATE POLICY email_studio_messages_select_staff ON public.email_studio_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS email_studio_messages_insert_staff ON public.email_studio_messages;
CREATE POLICY email_studio_messages_insert_staff ON public.email_studio_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
