-- Watermark for the daily surfboard saved-search alert cron.
-- The first row is written at "now" so the job never emails about boards
-- that were already listed when the cron starts.

CREATE TABLE IF NOT EXISTS public.saved_search_alert_cursors (
  job text PRIMARY KEY,
  listed_through timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_search_alert_cursors IS
  'Cron watermarks. surfboard_new_listings is the last listing_creation_events.listed_at fully processed. Alerts only consider surfboards first published after this time and after the saved search was created.';

ALTER TABLE public.saved_search_alert_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_search_alert_cursors_none" ON public.saved_search_alert_cursors;
CREATE POLICY "saved_search_alert_cursors_none"
  ON public.saved_search_alert_cursors
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.saved_search_alert_cursors FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.saved_search_alert_cursors TO service_role;
