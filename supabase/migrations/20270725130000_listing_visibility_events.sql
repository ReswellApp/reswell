-- Append-only audit log for listings.hidden_from_site changes.
-- Lets admins see how a listing entered (or left) the "checkout 404 / hidden" state.

CREATE TABLE IF NOT EXISTS public.listing_visibility_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  hidden_from_site boolean NOT NULL,
  source text NOT NULL,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_visibility_events_source_nonempty CHECK (char_length(trim(source)) > 0)
);

CREATE INDEX IF NOT EXISTS listing_visibility_events_listing_created_at_idx
  ON public.listing_visibility_events (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_visibility_events_created_at_idx
  ON public.listing_visibility_events (created_at DESC);

CREATE INDEX IF NOT EXISTS listing_visibility_events_source_created_at_idx
  ON public.listing_visibility_events (source, created_at DESC);

COMMENT ON TABLE public.listing_visibility_events IS
  'Append-only history of hidden_from_site changes (admin hide, vacation, inactivity, status, restore, etc.).';

COMMENT ON COLUMN public.listing_visibility_events.source IS
  'Machine source key: admin_site_visibility, admin_status, admin_restore, seller_vacation, seller_inactivity, seller_archive, seller_relist, publish_draft, impersonate_update, system.';

ALTER TABLE public.listing_visibility_events ENABLE ROW LEVEL SECURITY;

-- No direct client access; service role inserts/reads from admin APIs and services.
REVOKE ALL ON TABLE public.listing_visibility_events FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE public.listing_visibility_events TO service_role;
