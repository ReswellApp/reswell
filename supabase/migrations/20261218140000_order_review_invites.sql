-- Stable per-order review invite tokens for Klaviyo email deep links.

CREATE TABLE IF NOT EXISTS public.order_review_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  buyer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  post_purchase_sent_at timestamptz,
  fulfillment_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_review_invites_buyer_id_idx
  ON public.order_review_invites (buyer_id);

CREATE INDEX IF NOT EXISTS order_review_invites_seller_id_idx
  ON public.order_review_invites (seller_id);

COMMENT ON TABLE public.order_review_invites IS
  'One invite row per marketplace order; token powers direct review URLs in Klaviyo emails.';

COMMENT ON COLUMN public.order_review_invites.token IS
  'URL-safe opaque token for /review/[token] — never derived from order id.';

COMMENT ON COLUMN public.order_review_invites.post_purchase_sent_at IS
  'When the post-checkout review invite Klaviyo event was emitted.';

COMMENT ON COLUMN public.order_review_invites.fulfillment_reminder_sent_at IS
  'When the post-fulfillment review reminder Klaviyo event was emitted.';

ALTER TABLE public.order_review_invites ENABLE ROW LEVEL SECURITY;
