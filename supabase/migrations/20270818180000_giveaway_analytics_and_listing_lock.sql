-- Giveaway analytics: CTA / brand clicks, signup attribution, and a durable
-- listing_id that stays after the board sells or is marked sold.

ALTER TABLE public.giveaway_entries
  RENAME COLUMN qualifying_listing_id TO listing_id;

ALTER TABLE public.giveaway_entries
  ADD COLUMN IF NOT EXISTS signed_up_from_cta boolean NOT NULL DEFAULT false;

ALTER TABLE public.giveaway_entries
  ADD COLUMN IF NOT EXISTS cta_clicked_at timestamptz;

ALTER TABLE public.giveaway_entries
  ADD COLUMN IF NOT EXISTS brand_selected_at timestamptz;

ALTER TABLE public.giveaway_entries
  DROP CONSTRAINT IF EXISTS giveaway_entries_qualifying_listing_id_fkey;

ALTER TABLE public.giveaway_entries
  DROP CONSTRAINT IF EXISTS giveaway_entries_listing_id_fkey;

ALTER TABLE public.giveaway_entries
  ADD CONSTRAINT giveaway_entries_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings (id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS giveaway_entries_listing_idx
  ON public.giveaway_entries (listing_id)
  WHERE listing_id IS NOT NULL;

-- Once a listing is attached as the raffle ticket, never clear or swap it.
CREATE OR REPLACE FUNCTION public.giveaway_entries_keep_listing_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.listing_id IS NOT NULL THEN
    NEW.listing_id := OLD.listing_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS giveaway_entries_keep_listing_id ON public.giveaway_entries;
CREATE TRIGGER giveaway_entries_keep_listing_id
  BEFORE UPDATE ON public.giveaway_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.giveaway_entries_keep_listing_id();

COMMENT ON COLUMN public.giveaway_entries.listing_id IS
  'Surfboard listing that entered this user. Kept after the listing sells or is marked sold.';

CREATE TABLE IF NOT EXISTS public.giveaway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_slug text NOT NULL,
  event text NOT NULL CHECK (event IN ('cta_click', 'brand_click')),
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
  surface text NOT NULL CHECK (surface IN ('homepage', 'popup', 'giveaway_page')),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS giveaway_events_slug_event_created_idx
  ON public.giveaway_events (giveaway_slug, event, created_at DESC);

CREATE INDEX IF NOT EXISTS giveaway_events_brand_created_idx
  ON public.giveaway_events (giveaway_slug, preferred_brand, created_at DESC)
  WHERE preferred_brand IS NOT NULL;

ALTER TABLE public.giveaway_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "giveaway_events_insert" ON public.giveaway_events;
CREATE POLICY "giveaway_events_insert" ON public.giveaway_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "giveaway_events_select_staff" ON public.giveaway_events;
CREATE POLICY "giveaway_events_select_staff" ON public.giveaway_events
  FOR SELECT
  USING (public.is_admin_or_employee());

GRANT INSERT ON public.giveaway_events TO anon, authenticated;
GRANT SELECT ON public.giveaway_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.giveaway_events TO service_role;

COMMENT ON TABLE public.giveaway_events IS
  'Giveaway CTA and brand-picker clicks for admin analytics.';
