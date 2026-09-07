-- First-party ad click attribution stamped onto marketplace orders at checkout.
-- Source: gclid / gbraid / wbraid (Google Ads), fbclid + UTMs (Meta), persisted from
-- the buyer's landing cookie / Stripe payment-intent metadata.

CREATE TABLE IF NOT EXISTS public.order_ad_attribution (
  order_id uuid PRIMARY KEY REFERENCES public.orders (id) ON DELETE CASCADE,
  channel text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  landing_path text,
  landing_listing_id uuid,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_ad_attribution_channel_chk
    CHECK (channel IN ('google_ads', 'meta_ads', 'meta_referral', 'other'))
);

CREATE INDEX IF NOT EXISTS order_ad_attribution_channel_created_idx
  ON public.order_ad_attribution (channel, created_at DESC);

CREATE INDEX IF NOT EXISTS order_ad_attribution_gclid_idx
  ON public.order_ad_attribution (gclid)
  WHERE gclid IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_ad_attribution_fbclid_idx
  ON public.order_ad_attribution (fbclid)
  WHERE fbclid IS NOT NULL;

COMMENT ON TABLE public.order_ad_attribution IS
  'Last-click Google Ads / Meta attribution for a confirmed order. One row per order.';

ALTER TABLE public.order_ad_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_ad_attribution_staff_select" ON public.order_ad_attribution;
CREATE POLICY "order_ad_attribution_staff_select"
  ON public.order_ad_attribution FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
