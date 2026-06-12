-- Idempotency + fulfillment tracking for "notify me when listed" demand capture.
-- When a new surfboard matches an open board_listing_requests row, the server fires
-- Klaviyo metric "Board Listing Match" and marks the request fulfilled.

CREATE TABLE IF NOT EXISTS public.board_listing_request_alert_sent (
  request_id uuid NOT NULL REFERENCES public.board_listing_requests (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, listing_id)
);

CREATE INDEX IF NOT EXISTS board_listing_request_alert_sent_listing_id_idx
  ON public.board_listing_request_alert_sent (listing_id);

COMMENT ON TABLE public.board_listing_request_alert_sent IS
  'One Klaviyo Board Listing Match attempt per demand-capture request × listing (service role inserts).';

ALTER TABLE public.board_listing_request_alert_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_listing_request_alert_sent_none" ON public.board_listing_request_alert_sent;
CREATE POLICY "board_listing_request_alert_sent_none"
  ON public.board_listing_request_alert_sent FOR ALL
  USING (false)
  WITH CHECK (false);
