-- Seller-reported sale follow-up: where they sold, whether Reswell helped find a buyer,
-- and optional tips to Reswell after marking a listing sold off-platform.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sold_reswell_helped_find_buyer boolean;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_sold_off_platform_channel_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_sold_off_platform_channel_check
  CHECK (
    sold_off_platform_channel IS NULL
    OR sold_off_platform_channel IN ('reswell', 'fb_marketplace', 'craigslist', 'elsewhere')
  );

COMMENT ON COLUMN public.listings.sold_off_platform_channel IS
  'Off-platform sale channel: reswell, fb_marketplace, craigslist, or elsewhere.';
COMMENT ON COLUMN public.listings.sold_reswell_helped_find_buyer IS
  'Seller-reported: whether Reswell helped them find a buyer when marking sold.';

CREATE TABLE IF NOT EXISTS public.seller_sale_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 100 AND amount_cents <= 50000),
  stripe_payment_intent_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'canceled', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz
);

CREATE INDEX IF NOT EXISTS seller_sale_tips_seller_created_idx
  ON public.seller_sale_tips (seller_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_sale_tips_listing_idx
  ON public.seller_sale_tips (listing_id);

ALTER TABLE public.seller_sale_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_sale_tips_select_own" ON public.seller_sale_tips;
CREATE POLICY "seller_sale_tips_select_own" ON public.seller_sale_tips
  FOR SELECT
  USING (auth.uid() = seller_user_id);

DROP POLICY IF EXISTS "seller_sale_tips_select_staff" ON public.seller_sale_tips;
CREATE POLICY "seller_sale_tips_select_staff" ON public.seller_sale_tips
  FOR SELECT
  USING (public.is_admin_or_employee());

GRANT SELECT ON public.seller_sale_tips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_sale_tips TO service_role;

COMMENT ON TABLE public.seller_sale_tips IS
  'Optional tips sellers send to Reswell after marking a listing sold off-platform.';
