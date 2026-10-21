-- In-app notification publisher.
-- Rows gain a stable dedupe key, display fields, and a dispatch log so each
-- event type can be sent once, updated in place, or capped into a daily digest.
-- Favorite inserts no longer write notifications from a trigger. The app publisher
-- is the only writer, which is what enforces the daily caps.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS href text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notifications.title IS
  'Short inbox label. message/body remain the sentence the Activity tab shows.';
COMMENT ON COLUMN public.notifications.body IS
  'Same copy as message. Kept so newer readers do not depend on the legacy column.';
COMMENT ON COLUMN public.notifications.href IS
  'Relative in-app path for this row.';
COMMENT ON COLUMN public.notifications.dedupe_key IS
  'Stable identity for one recipient. Null on rows written before the publisher.';
COMMENT ON COLUMN public.notifications.metadata IS
  'Type-specific facts (prices, digest count, offer id).';

-- Multiple legacy rows have a null dedupe key. Postgres unique treats those as distinct.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_dedupe_key;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_dedupe_key UNIQUE (user_id, dedupe_key);

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'listing_saved',
    'listing_saved_digest',
    'offer_received',
    'offer_countered',
    'offer_accepted',
    'offer_declined',
    'offer_withdrawn',
    'offer_expired',
    'offer_expiring_soon',
    'new_listing_from_followed',
    'new_listing_from_followed_digest',
    'price_drop_from_followed',
    'payout_info_required'
  ));

CREATE TABLE IF NOT EXISTS public.notification_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type text NOT NULL,
  dedupe_key text NOT NULL,
  subject_key text,
  outcome text NOT NULL CHECK (outcome IN ('delivered', 'digested')),
  rollup_key text,
  notification_id uuid REFERENCES public.notifications (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_dispatch_log_user_dedupe UNIQUE (user_id, dedupe_key)
);

COMMENT ON TABLE public.notification_dispatch_log IS
  'One row per recipient and event key. delivered counts toward a cap. digested means the event was folded into a digest row and must not be applied again.';

CREATE INDEX IF NOT EXISTS notification_dispatch_log_window_idx
  ON public.notification_dispatch_log (user_id, type, created_at DESC)
  WHERE outcome = 'delivered';

CREATE INDEX IF NOT EXISTS notification_dispatch_log_rollup_idx
  ON public.notification_dispatch_log (user_id, rollup_key)
  WHERE outcome = 'digested';

ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_dispatch_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_dispatch_log TO service_role;

CREATE TABLE IF NOT EXISTS public.notification_fanout_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('new_listing')),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  cursor text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT notification_fanout_jobs_kind_listing UNIQUE (kind, listing_id)
);

COMMENT ON TABLE public.notification_fanout_jobs IS
  'Queues follower in-app fan-out so publishing a listing does not write one notification per follower in the request.';

CREATE INDEX IF NOT EXISTS notification_fanout_jobs_pending_idx
  ON public.notification_fanout_jobs (created_at)
  WHERE status = 'pending';

ALTER TABLE public.notification_fanout_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_fanout_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_fanout_jobs TO service_role;

DROP TRIGGER IF EXISTS on_favorite_created ON public.favorites;
DROP FUNCTION IF EXISTS public.notify_listing_owner_on_favorite();
