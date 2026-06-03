-- Demand capture for dead-end searches: shoppers ask Reswell to find a seller / notify when listed.
-- Writes go through a server action using the service role; clients never read or write directly.

CREATE TABLE IF NOT EXISTS public.board_listing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text NOT NULL,
  query text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'boards',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_listing_requests_created_at_idx
  ON public.board_listing_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS board_listing_requests_email_idx
  ON public.board_listing_requests (email);

CREATE INDEX IF NOT EXISTS board_listing_requests_status_idx
  ON public.board_listing_requests (status)
  WHERE status = 'open';

COMMENT ON TABLE public.board_listing_requests IS
  'Buyer demand captured on no-results search screens (/boards, /search). Each row = a shopper who hit a dead end and asked Reswell to source the board / notify them when one is listed.';

COMMENT ON COLUMN public.board_listing_requests.query IS
  'Raw keyword the shopper searched, when present.';

COMMENT ON COLUMN public.board_listing_requests.criteria IS
  'Normalized /boards filter snapshot (q, brand, model, dimensions, type, condition, price) at the time of the dead-end search.';

COMMENT ON COLUMN public.board_listing_requests.source IS
  'Which no-results surface captured the request: boards | search.';

COMMENT ON COLUMN public.board_listing_requests.status IS
  'Ops triage state: open | sourcing | fulfilled | closed.';

ALTER TABLE public.board_listing_requests ENABLE ROW LEVEL SECURITY;

-- No client access; server captures via service role only.
DROP POLICY IF EXISTS "board_listing_requests_none" ON public.board_listing_requests;
CREATE POLICY "board_listing_requests_none"
  ON public.board_listing_requests FOR ALL
  USING (false)
  WITH CHECK (false);
