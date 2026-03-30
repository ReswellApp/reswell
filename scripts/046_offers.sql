-- Offers & Negotiation System
-- Adds: offers, offer_messages, offer_settings
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

-- ─────────────────────────────────────────────────────────────
-- offer_messages  (full thread / audit trail)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.offer_messages (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    UUID             NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  sender_id   UUID             NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role offer_role_enum  NOT NULL,
  action      offer_action_enum NOT NULL,
  amount      DECIMAL(10, 2),
  note        TEXT             CHECK (LENGTH(note) <= 200),
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE public.offer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offer_msgs_admin_all"          ON public.offer_messages;
DROP POLICY IF EXISTS "offer_msgs_participant_read"   ON public.offer_messages;
DROP POLICY IF EXISTS "offer_msgs_participant_insert" ON public.offer_messages;

CREATE POLICY "offer_msgs_admin_all" ON public.offer_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

CREATE POLICY "offer_msgs_participant_read" ON public.offer_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_messages.offer_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

CREATE POLICY "offer_msgs_participant_insert" ON public.offer_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_messages.offer_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- offer_settings  (per-listing seller configuration)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.offer_settings (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id         UUID          NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  offers_enabled     BOOLEAN       NOT NULL DEFAULT true,
  minimum_offer_pct  INTEGER       NOT NULL DEFAULT 70 CHECK (minimum_offer_pct BETWEEN 50 AND 90),
  auto_decline_below DECIMAL(10, 2),
  auto_accept_above  DECIMAL(10, 2),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.offer_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offer_settings_admin_all"    ON public.offer_settings;
DROP POLICY IF EXISTS "offer_settings_public_read"  ON public.offer_settings;
DROP POLICY IF EXISTS "offer_settings_seller_write" ON public.offer_settings;

CREATE POLICY "offer_settings_admin_all" ON public.offer_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

-- Anyone can read settings (needed to show/hide the offer button)
CREATE POLICY "offer_settings_public_read" ON public.offer_settings
  FOR SELECT USING (true);

-- Only the listing owner can upsert their settings
CREATE POLICY "offer_settings_seller_write" ON public.offer_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = offer_settings.listing_id AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = offer_settings.listing_id AND l.user_id = auth.uid()
    )
  );

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

CREATE INDEX IF NOT EXISTS idx_offer_msgs_offer_id ON public.offer_messages (offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_settings_lid  ON public.offer_settings (listing_id);

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
-- updated_at trigger for offers and offer_settings
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

DROP TRIGGER IF EXISTS offer_settings_set_updated_at ON public.offer_settings;
CREATE TRIGGER offer_settings_set_updated_at
  BEFORE UPDATE ON public.offer_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
