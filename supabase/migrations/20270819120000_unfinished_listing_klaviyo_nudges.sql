-- Idempotency for Klaviyo **Unfinished Listing** (abandoned sell-flow drafts).
-- Cron emits one event per draft after the seller stops editing.

CREATE TABLE IF NOT EXISTS public.unfinished_listing_klaviyo_nudges (
  listing_id uuid PRIMARY KEY REFERENCES public.listings (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS unfinished_listing_klaviyo_nudges_user_idx
  ON public.unfinished_listing_klaviyo_nudges (user_id);

CREATE INDEX IF NOT EXISTS unfinished_listing_klaviyo_nudges_sent_idx
  ON public.unfinished_listing_klaviyo_nudges (sent_at DESC);

COMMENT ON TABLE public.unfinished_listing_klaviyo_nudges IS
  'One row per listing after Klaviyo Unfinished Listing is accepted. Prevents repeat abandonment emails.';

ALTER TABLE public.unfinished_listing_klaviyo_nudges ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.unfinished_listing_klaviyo_nudges TO service_role;
