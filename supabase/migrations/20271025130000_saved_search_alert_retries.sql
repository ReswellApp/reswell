-- Short retry queue for surfboard saved-search alerts when the listing
-- is not visible in the search index yet. Give up about an hour after
-- first publish. Sends stay idempotent via saved_search_alert_sent.

CREATE TABLE IF NOT EXISTS public.saved_search_alert_retries (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL,
  give_up_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_search_alert_retries_due_idx
  ON public.saved_search_alert_retries (next_attempt_at);

COMMENT ON TABLE public.saved_search_alert_retries IS
  'Index-lag retries for surfboard saved-search alerts. One row per listing, retried for about an hour after listing_creation_events.listed_at. Not a backfill of boards already listed.';

ALTER TABLE public.saved_search_alert_retries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_search_alert_retries_none" ON public.saved_search_alert_retries;
CREATE POLICY "saved_search_alert_retries_none"
  ON public.saved_search_alert_retries
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.saved_search_alert_retries FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_search_alert_retries TO service_role;
