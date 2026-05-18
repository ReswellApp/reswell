-- Saved surfboard browse filters + optional email alerts (Klaviyo: Board Alert Match).

CREATE TABLE IF NOT EXISTS public.board_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  label text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_notifications_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_saved_searches_user_id_idx
  ON public.board_saved_searches (user_id);

CREATE INDEX IF NOT EXISTS board_saved_searches_email_enabled_idx
  ON public.board_saved_searches (email_notifications_enabled)
  WHERE email_notifications_enabled = true;

COMMENT ON TABLE public.board_saved_searches IS
  'User-saved /boards filter snapshots; optional Klaviyo-backed email when new listings match.';

COMMENT ON COLUMN public.board_saved_searches.criteria IS
  'Normalized filter payload (q, brand, model, dimensions, type, condition, price, sort). Legacy keys may include location/geo — ignored for nationwide email matching.';

COMMENT ON COLUMN public.board_saved_searches.email_notifications_enabled IS
  'When true, eligible listings trigger metric Board Alert Match to this user profile.';

ALTER TABLE public.board_saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_saved_searches_select_own" ON public.board_saved_searches;
CREATE POLICY "board_saved_searches_select_own"
  ON public.board_saved_searches FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_saved_searches_insert_own" ON public.board_saved_searches;
CREATE POLICY "board_saved_searches_insert_own"
  ON public.board_saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_saved_searches_update_own" ON public.board_saved_searches;
CREATE POLICY "board_saved_searches_update_own"
  ON public.board_saved_searches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_saved_searches_delete_own" ON public.board_saved_searches;
CREATE POLICY "board_saved_searches_delete_own"
  ON public.board_saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Idempotency: one alert email attempt per saved search × listing (service role inserts).
CREATE TABLE IF NOT EXISTS public.board_saved_search_alert_sent (
  saved_search_id uuid NOT NULL REFERENCES public.board_saved_searches (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (saved_search_id, listing_id)
);

CREATE INDEX IF NOT EXISTS board_saved_search_alert_sent_listing_id_idx
  ON public.board_saved_search_alert_sent (listing_id);

ALTER TABLE public.board_saved_search_alert_sent ENABLE ROW LEVEL SECURITY;

-- No client access; server uses service role only.
DROP POLICY IF EXISTS "board_saved_search_alert_sent_none" ON public.board_saved_search_alert_sent;
CREATE POLICY "board_saved_search_alert_sent_none"
  ON public.board_saved_search_alert_sent FOR ALL
  USING (false)
  WITH CHECK (false);
