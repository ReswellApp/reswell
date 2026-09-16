-- Singleton root prompt for the support-reply agent. Staff edit this on
-- /admin/support-reply-examples; generation always treats it as the first
-- source of truth for voice, kindness, and how to write.

CREATE TABLE IF NOT EXISTS public.support_reply_root_prompt (
  id text PRIMARY KEY DEFAULT 'global',
  body text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_reply_root_prompt_singleton CHECK (id = 'global')
);

COMMENT ON TABLE public.support_reply_root_prompt IS
  'Singleton (id=global) root prompt the CS agent follows first when drafting support replies.';

INSERT INTO public.support_reply_root_prompt (id, body)
VALUES ('global', '')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS support_reply_root_prompt_set_updated_at ON public.support_reply_root_prompt;
CREATE TRIGGER support_reply_root_prompt_set_updated_at
  BEFORE UPDATE ON public.support_reply_root_prompt
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.support_reply_root_prompt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_reply_root_prompt_staff_all ON public.support_reply_root_prompt;
CREATE POLICY support_reply_root_prompt_staff_all ON public.support_reply_root_prompt
  FOR ALL
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

GRANT SELECT, INSERT, UPDATE ON TABLE public.support_reply_root_prompt TO authenticated, service_role;
