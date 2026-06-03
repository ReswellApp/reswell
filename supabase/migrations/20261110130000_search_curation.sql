-- Search curation: admin-managed synonyms (fix misspellings / aliases) and pinned
-- listings for queries that otherwise return nothing.
-- Staff (admin + employee) may read; only admins may write. Runtime shopper reads
-- happen server-side via the service role (cached), so no public policy is needed.

-- ---------------------------------------------------------------------------
-- 1. Synonyms: when a shopper's query matches `term`, the search is expanded
--    with `expansions` (e.g. "ci" -> {"channel islands"}, "chanel" -> {"chanel"... }).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  expansions text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_synonyms_term_unique
  ON public.search_synonyms (lower(term));

CREATE INDEX IF NOT EXISTS search_synonyms_enabled_idx
  ON public.search_synonyms (enabled)
  WHERE enabled = true;

COMMENT ON TABLE public.search_synonyms IS
  'Admin-curated query expansions for marketplace search. When a search matches `term`, `expansions` terms are OR-added to the ES query + Supabase fallback to recover misspellings/aliases.';

ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_synonyms_select_staff" ON public.search_synonyms;
CREATE POLICY "search_synonyms_select_staff" ON public.search_synonyms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "search_synonyms_insert_admin" ON public.search_synonyms;
CREATE POLICY "search_synonyms_insert_admin" ON public.search_synonyms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "search_synonyms_update_admin" ON public.search_synonyms;
CREATE POLICY "search_synonyms_update_admin" ON public.search_synonyms
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "search_synonyms_delete_admin" ON public.search_synonyms;
CREATE POLICY "search_synonyms_delete_admin" ON public.search_synonyms
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- ---------------------------------------------------------------------------
-- 2. Result overrides: a normalized query that an admin wants to hand-fill with
--    specific listings (used when organic search returns nothing).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_result_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_normalized text NOT NULL,
  query_display text,
  note text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_result_overrides_query_unique
  ON public.search_result_overrides (query_normalized);

COMMENT ON TABLE public.search_result_overrides IS
  'Admin-pinned results for specific marketplace search queries. Applied when organic search (ES + Supabase) returns zero listings, so dead-end demand still sees relevant boards.';

ALTER TABLE public.search_result_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_result_overrides_select_staff" ON public.search_result_overrides;
CREATE POLICY "search_result_overrides_select_staff" ON public.search_result_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "search_result_overrides_insert_admin" ON public.search_result_overrides;
CREATE POLICY "search_result_overrides_insert_admin" ON public.search_result_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "search_result_overrides_update_admin" ON public.search_result_overrides;
CREATE POLICY "search_result_overrides_update_admin" ON public.search_result_overrides
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "search_result_overrides_delete_admin" ON public.search_result_overrides;
CREATE POLICY "search_result_overrides_delete_admin" ON public.search_result_overrides
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- ---------------------------------------------------------------------------
-- 3. Override → listings join (ordered pins).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_result_override_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id uuid NOT NULL REFERENCES public.search_result_overrides (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_result_override_listings_unique
  ON public.search_result_override_listings (override_id, listing_id);

CREATE INDEX IF NOT EXISTS search_result_override_listings_override_idx
  ON public.search_result_override_listings (override_id);

COMMENT ON TABLE public.search_result_override_listings IS
  'Ordered listings pinned to a search_result_overrides row.';

ALTER TABLE public.search_result_override_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_result_override_listings_select_staff" ON public.search_result_override_listings;
CREATE POLICY "search_result_override_listings_select_staff" ON public.search_result_override_listings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS "search_result_override_listings_insert_admin" ON public.search_result_override_listings;
CREATE POLICY "search_result_override_listings_insert_admin" ON public.search_result_override_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "search_result_override_listings_update_admin" ON public.search_result_override_listings;
CREATE POLICY "search_result_override_listings_update_admin" ON public.search_result_override_listings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "search_result_override_listings_delete_admin" ON public.search_result_override_listings;
CREATE POLICY "search_result_override_listings_delete_admin" ON public.search_result_override_listings
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
