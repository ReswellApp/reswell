-- LLM draft replies for the support inbox: cached suggestion per case,
-- plus staff ratings / sent copy so later drafts learn from what Hayden sends.

CREATE TABLE IF NOT EXISTS public.support_reply_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.support_cases (id) ON DELETE CASCADE,
  body text NOT NULL,
  model text,
  prompt_version text NOT NULL,
  source_fingerprint text NOT NULL,
  cited_help_slugs text[] NOT NULL DEFAULT '{}',
  retrieved_example_ids uuid[] NOT NULL DEFAULT '{}',
  origin text NOT NULL DEFAULT 'llm'
    CHECK (origin IN ('llm', 'example', 'macro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id)
);

CREATE INDEX IF NOT EXISTS support_reply_drafts_updated_idx
  ON public.support_reply_drafts (updated_at DESC);

COMMENT ON TABLE public.support_reply_drafts IS
  'Latest suggested customer-service reply for a support case. Regenerated when the thread fingerprint changes.';

CREATE TABLE IF NOT EXISTS public.support_reply_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.support_cases (id) ON DELETE SET NULL,
  kind text,
  customer_excerpt text NOT NULL,
  staff_reply text NOT NULL,
  cited_help_slugs text[] NOT NULL DEFAULT '{}',
  rating text NOT NULL
    CHECK (rating IN ('accepted', 'edited', 'rejected')),
  draft_id uuid REFERENCES public.support_reply_drafts (id) ON DELETE SET NULL,
  rated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_reply_examples_kind_created_idx
  ON public.support_reply_examples (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS support_reply_examples_rating_created_idx
  ON public.support_reply_examples (rating, created_at DESC);

COMMENT ON TABLE public.support_reply_examples IS
  'Sent or rated support replies used as few-shot memory for later draft generation.';

ALTER TABLE public.support_reply_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_reply_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_reply_drafts_staff_all ON public.support_reply_drafts;
CREATE POLICY support_reply_drafts_staff_all ON public.support_reply_drafts
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

DROP POLICY IF EXISTS support_reply_examples_staff_all ON public.support_reply_examples;
CREATE POLICY support_reply_examples_staff_all ON public.support_reply_examples
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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_reply_drafts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_reply_examples TO authenticated, service_role;
