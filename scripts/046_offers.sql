-- Offers & Negotiation System
-- Adds: offers (with embedded offer_timeline JSONB).
-- Listing minimum-offer rules: public.listings.minimum_offer_pct — see ALTER below.
-- Extends notifications to support offer event types

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE offer_status_enum AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'COUNTERED',
    'EXPIRED',
    'WITHDRAWN',
    'COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offer_role_enum AS ENUM ('BUYER', 'SELLER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offer_action_enum AS ENUM (
    'OFFER',
    'COUNTER',
    'ACCEPT',
    'DECLINE',
    'WITHDRAW',
    'MESSAGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- offers
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.offers (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       UUID             NOT NULL REFERENCES public.listings(id)  ON DELETE CASCADE,
  buyer_id         UUID             NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  seller_id        UUID             NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  status           offer_status_enum NOT NULL DEFAULT 'PENDING',
  initial_amount   DECIMAL(10, 2)   NOT NULL,
  current_amount   DECIMAL(10, 2)   NOT NULL,
  -- tracks how many counters have been made (max 3 total)
  counter_count    INTEGER          NOT NULL DEFAULT 0,
  -- append-only negotiation events (OFFER, COUNTER, ACCEPT, DECLINE, …)
  offer_timeline   jsonb            NOT NULL DEFAULT '[]'::jsonb,
  expires_at       TIMESTAMPTZ      NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_admin_all"      ON public.offers;
DROP POLICY IF EXISTS "offers_buyer_read"     ON public.offers;
DROP POLICY IF EXISTS "offers_seller_read"    ON public.offers;
DROP POLICY IF EXISTS "offers_buyer_insert"   ON public.offers;
DROP POLICY IF EXISTS "offers_participant_update" ON public.offers;

CREATE POLICY "offers_admin_all" ON public.offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

CREATE POLICY "offers_buyer_read" ON public.offers
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "offers_seller_read" ON public.offers
  FOR SELECT USING (seller_id = auth.uid());

-- Buyers insert their own offers; API route validates all business rules
CREATE POLICY "offers_buyer_insert" ON public.offers
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Participants (buyer or seller) can update offers they're part of
-- Full business-rule enforcement happens in the API route, not in RLS
CREATE POLICY "offers_participant_update" ON public.offers
  FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Server-only append for offer_timeline (see supabase migration + lib/services/appendOfferTimeline.ts)
CREATE OR REPLACE FUNCTION public.append_offer_timeline(
  p_offer_id uuid,
  p_entry jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.offers
  SET
    offer_timeline = COALESCE(offer_timeline, '[]'::jsonb) || jsonb_build_array(p_entry),
    updated_at = NOW()
  WHERE id = p_offer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer % not found', p_offer_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.append_offer_timeline(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_offer_timeline(uuid, jsonb) TO service_role;

-- Per-listing minimum offer percentage (merged from deprecated offer_settings)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS minimum_offer_pct integer;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_minimum_offer_pct_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_minimum_offer_pct_check CHECK (
    minimum_offer_pct IS NULL OR (
      minimum_offer_pct >= 50 AND minimum_offer_pct <= 90
    )
  );

COMMENT ON COLUMN public.listings.minimum_offer_pct IS
  'Minimum acceptable offer as % of list price (50–90). NULL = platform default (70%).';

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offers_listing_id   ON public.offers (listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_buyer_id     ON public.offers (buyer_id);
CREATE INDEX IF NOT EXISTS idx_offers_seller_id    ON public.offers (seller_id);
CREATE INDEX IF NOT EXISTS idx_offers_status       ON public.offers (status);
CREATE INDEX IF NOT EXISTS idx_offers_expires_at   ON public.offers (expires_at);
-- fast lookup: is there an active offer from this buyer on this listing?
CREATE INDEX IF NOT EXISTS idx_offers_listing_buyer ON public.offers (listing_id, buyer_id, status);

-- ─────────────────────────────────────────────────────────────
-- Extend notifications to support offer event types
-- ─────────────────────────────────────────────────────────────

-- Drop old check constraint and re-add with offer types
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'listing_saved',
    'offer_received',
    'offer_countered',
    'offer_accepted',
    'offer_declined',
    'offer_withdrawn',
    'offer_expired',
    'offer_expiring_soon'
  ));

-- Allow the API (service role) to insert notifications on behalf of users
DROP POLICY IF EXISTS "notifications_service_insert" ON public.notifications;
CREATE POLICY "notifications_service_insert" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- updated_at trigger for offers
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS offers_set_updated_at ON public.offers;
CREATE TRIGGER offers_set_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
