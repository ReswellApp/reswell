-- Raffle / giveaway entries. Catalog of current giveaways lives in code;
-- this table stores who entered and which prize brand they want.

CREATE TABLE IF NOT EXISTS public.giveaway_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  giveaway_slug text NOT NULL,
  preferred_brand text
    CHECK (
      preferred_brand IS NULL
      OR preferred_brand IN (
        'channel-islands',
        'mayhem',
        'js',
        'sharpeye',
        'hayden-shapes',
        'lovemachine'
      )
    ),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'qualified')),
  qualifying_listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  qualified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, giveaway_slug)
);

CREATE INDEX IF NOT EXISTS giveaway_entries_slug_status_idx
  ON public.giveaway_entries (giveaway_slug, status);

CREATE INDEX IF NOT EXISTS giveaway_entries_user_idx
  ON public.giveaway_entries (user_id, created_at DESC);

ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "giveaway_entries_select_own" ON public.giveaway_entries;
CREATE POLICY "giveaway_entries_select_own" ON public.giveaway_entries
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "giveaway_entries_insert_own" ON public.giveaway_entries;
CREATE POLICY "giveaway_entries_insert_own" ON public.giveaway_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "giveaway_entries_update_own" ON public.giveaway_entries;
CREATE POLICY "giveaway_entries_update_own" ON public.giveaway_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "giveaway_entries_select_staff" ON public.giveaway_entries;
CREATE POLICY "giveaway_entries_select_staff" ON public.giveaway_entries
  FOR SELECT
  USING (public.is_admin_or_employee());

GRANT SELECT, INSERT, UPDATE ON public.giveaway_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.giveaway_entries TO service_role;

COMMENT ON TABLE public.giveaway_entries IS
  'Raffle entries for Reswell giveaways. Qualified when the seller publishes a surfboard listing.';
