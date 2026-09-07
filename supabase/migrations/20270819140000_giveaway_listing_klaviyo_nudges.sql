-- Idempotency for Klaviyo **Giveaway Listing Reminder** (raffle entered, no board listed).
-- Cron / admin emit one event per pending giveaway entry.

CREATE TABLE IF NOT EXISTS public.giveaway_listing_klaviyo_nudges (
  entry_id uuid PRIMARY KEY REFERENCES public.giveaway_entries (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS giveaway_listing_klaviyo_nudges_user_idx
  ON public.giveaway_listing_klaviyo_nudges (user_id);

CREATE INDEX IF NOT EXISTS giveaway_listing_klaviyo_nudges_sent_idx
  ON public.giveaway_listing_klaviyo_nudges (sent_at DESC);

COMMENT ON TABLE public.giveaway_listing_klaviyo_nudges IS
  'One row per raffle entry after Klaviyo Giveaway Listing Reminder is accepted. Prevents repeat emails.';

ALTER TABLE public.giveaway_listing_klaviyo_nudges ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.giveaway_listing_klaviyo_nudges TO service_role;
