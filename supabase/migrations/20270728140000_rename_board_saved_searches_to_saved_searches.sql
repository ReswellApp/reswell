-- Rename board-scoped saved searches → marketplace saved searches.
-- Add section + category_id so each row is tagged by marketplace category.

-- --------------------------------------------------------------------------
-- Rename tables
-- --------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.board_saved_searches RENAME TO saved_searches;
ALTER TABLE IF EXISTS public.board_saved_search_alert_sent RENAME TO saved_search_alert_sent;

-- --------------------------------------------------------------------------
-- Rename indexes
-- --------------------------------------------------------------------------

ALTER INDEX IF EXISTS public.board_saved_searches_user_id_idx
  RENAME TO saved_searches_user_id_idx;
ALTER INDEX IF EXISTS public.board_saved_searches_email_enabled_idx
  RENAME TO saved_searches_email_enabled_idx;
ALTER INDEX IF EXISTS public.board_saved_search_alert_sent_listing_id_idx
  RENAME TO saved_search_alert_sent_listing_id_idx;

-- --------------------------------------------------------------------------
-- Rename RLS policies
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "board_saved_searches_select_own" ON public.saved_searches;
CREATE POLICY "saved_searches_select_own"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_saved_searches_insert_own" ON public.saved_searches;
CREATE POLICY "saved_searches_insert_own"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_saved_searches_update_own" ON public.saved_searches;
CREATE POLICY "saved_searches_update_own"
  ON public.saved_searches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_saved_searches_delete_own" ON public.saved_searches;
CREATE POLICY "saved_searches_delete_own"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_saved_search_alert_sent_none" ON public.saved_search_alert_sent;
CREATE POLICY "saved_search_alert_sent_none"
  ON public.saved_search_alert_sent FOR ALL
  USING (false)
  WITH CHECK (false);

-- --------------------------------------------------------------------------
-- Tag columns: section + category_id
-- --------------------------------------------------------------------------

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL;

COMMENT ON TABLE public.saved_searches IS
  'User-saved marketplace browse/search snapshots (any peer section); optional Klaviyo Board Alert Match when a matching listing goes live.';

COMMENT ON COLUMN public.saved_searches.section IS
  'Peer listing section this search targets (surfboards, fins, wetsuits, …). NULL = any peer section (marketplace /search).';

COMMENT ON COLUMN public.saved_searches.category_id IS
  'Optional public.categories.id tag: fixed peer-section category, or a single surfboard style category when the search is style-scoped.';

COMMENT ON COLUMN public.saved_searches.criteria IS
  'Normalized filter payload (section, q, brand, facets, price, …). Legacy geo keys ignored for nationwide email matching.';

-- Backfill section from criteria JSON (default surfboards for legacy board-only rows).
UPDATE public.saved_searches
SET section = COALESCE(
  NULLIF(trim(criteria ->> 'section'), ''),
  CASE
    WHEN (criteria ->> 'anySection') IN ('true', 't', '1') THEN NULL
    ELSE 'surfboards'
  END
)
WHERE section IS NULL
  AND COALESCE((criteria ->> 'anySection') IN ('true', 't', '1'), false) = false;

-- anySection searches stay section-null
UPDATE public.saved_searches
SET section = NULL
WHERE (criteria ->> 'anySection') IN ('true', 't', '1');

-- Backfill fixed peer category ids (must match listing-config constants / seeds).
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000001'::uuid
WHERE section = 'fins' AND category_id IS NULL;
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000002'::uuid
WHERE section = 'wetsuits' AND category_id IS NULL;
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000003'::uuid
WHERE section = 'boardbags' AND category_id IS NULL;
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000004'::uuid
WHERE section = 'surfpacks' AND category_id IS NULL;
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000005'::uuid
WHERE section = 'leashes' AND category_id IS NULL;
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000006'::uuid
WHERE section = 'apparel' AND category_id IS NULL;
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000007'::uuid
WHERE section = 'accessories' AND category_id IS NULL;
UPDATE public.saved_searches SET category_id = 'f1115a1e-aaaa-4bbb-8ccc-000000000008'::uuid
WHERE section = 'magazines' AND category_id IS NULL;

-- Surfboards: when criteria pins a single board style, tag that category id.
UPDATE public.saved_searches s
SET category_id = m.category_id
FROM (
  VALUES
    ('shortboard', '7e434a96-f3f7-4a73-b733-704a769195e6'::uuid),
    ('longboard', '47a0d0bb-8738-43b4-a0fe-a5b2acc72fa3'::uuid),
    ('hybrid', '93b8eeaf-366b-4823-8bb9-98d42c5fefba'::uuid),
    ('mid-length', '93b8eeaf-366b-4823-8bb9-98d42c5fefba'::uuid),
    ('funboard', '93b8eeaf-366b-4823-8bb9-98d42c5fefba'::uuid),
    ('step-up-gun', '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a'::uuid),
    ('step-up', '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a'::uuid),
    ('gun', '91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a'::uuid),
    ('groveler', 'f3ccddc0-f0f3-45d3-ad43-51bcf9935b45'::uuid),
    ('fish', 'a5b6c7d8-e9f0-4123-a456-7890abcdef01'::uuid),
    ('asym', 'b6c7d8e9-f0a1-4234-b567-890abcdef012'::uuid),
    ('other', 'c3d4e5f6-a7b8-49c0-b123-456789abcdef'::uuid)
) AS m(slug, category_id)
WHERE s.section = 'surfboards'
  AND s.category_id IS NULL
  AND (
    lower(trim(s.criteria ->> 'type')) = m.slug
    OR (
      jsonb_typeof(s.criteria -> 'style') = 'array'
      AND jsonb_array_length(s.criteria -> 'style') = 1
      AND lower(trim(s.criteria -> 'style' ->> 0)) = m.slug
    )
  );

CREATE INDEX IF NOT EXISTS saved_searches_section_idx
  ON public.saved_searches (section);

CREATE INDEX IF NOT EXISTS saved_searches_category_id_idx
  ON public.saved_searches (category_id);

CREATE INDEX IF NOT EXISTS saved_searches_email_section_idx
  ON public.saved_searches (section)
  WHERE email_notifications_enabled = true;
