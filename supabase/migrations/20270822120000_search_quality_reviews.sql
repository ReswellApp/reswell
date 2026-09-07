-- Search quality reviews: capture marketplace search result sets + LLM helper
-- snapshots so admins can rate Good / Close / Bad and feed that memory back
-- into NL search.

CREATE TABLE IF NOT EXISTS public.search_quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  query_display text NOT NULL,
  query_normalized text NOT NULL,
  search_surface text NOT NULL
    CHECK (search_surface IN ('marketplace', 'boards')),
  backend text
    CHECK (backend IS NULL OR backend IN ('elasticsearch', 'supabase')),
  result_count integer NOT NULL DEFAULT 0,
  listing_ids uuid[] NOT NULL DEFAULT '{}',
  listings_preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  rules_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  nl_helper jsonb,
  nl_skipped boolean,
  result_rating text
    CHECK (result_rating IS NULL OR result_rating IN ('good', 'close', 'bad')),
  llm_rating text
    CHECK (llm_rating IS NULL OR llm_rating IN ('good', 'close', 'bad')),
  listing_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  rating_note text,
  rated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  rated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_quality_events_occurred_at_idx
  ON public.search_quality_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS search_quality_events_query_idx
  ON public.search_quality_events (query_normalized, occurred_at DESC);

CREATE INDEX IF NOT EXISTS search_quality_events_unrated_idx
  ON public.search_quality_events (occurred_at DESC)
  WHERE result_rating IS NULL;

COMMENT ON TABLE public.search_quality_events IS
  'One row per marketplace keyword search: listings shown, rules parse, optional Gemini NL helper snapshot, and admin Good/Close/Bad ratings used as few-shot memory.';

ALTER TABLE public.search_quality_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_quality_events_select_staff" ON public.search_quality_events;
CREATE POLICY "search_quality_events_select_staff" ON public.search_quality_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "search_quality_events_insert_admin" ON public.search_quality_events;
CREATE POLICY "search_quality_events_insert_admin" ON public.search_quality_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "search_quality_events_update_admin" ON public.search_quality_events;
CREATE POLICY "search_quality_events_update_staff" ON public.search_quality_events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "search_quality_events_delete_admin" ON public.search_quality_events;
CREATE POLICY "search_quality_events_delete_admin" ON public.search_quality_events
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
