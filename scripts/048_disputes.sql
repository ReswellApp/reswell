-- Dispute Resolution System
-- Full buyer + seller protection — nobody keeps both item and money.
-- Adds: disputes, dispute_messages, dispute_evidence, dispute_flags,
--       notification type extensions, and fraud-detection helpers.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE dispute_reason_enum AS ENUM (
    'NOT_AS_DESCRIBED',
    'NOT_RECEIVED',
    'DAMAGED',
    'WRONG_ITEM',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status_enum AS ENUM (
    'OPEN',
    'AWAITING_SELLER',
    'AWAITING_BUYER',
    'RETURN_REQUESTED',
    'RETURN_SHIPPED',
    'RETURN_RECEIVED',
    'UNDER_REVIEW',
    'RESOLVED_REFUND',
    'RESOLVED_NO_REFUND',
    'RESOLVED_KEEP_ITEM',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_resolution_enum AS ENUM (
    'FULL_REFUND',
    'PARTIAL_REFUND',
    'REPLACEMENT',
    'FLAG_ONLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_sender_role_enum AS ENUM (
    'BUYER',
    'SELLER',
    'ADMIN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_evidence_type_enum AS ENUM (
    'PHOTO',
    'TRACKING',
    'SCREENSHOT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- disputes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.disputes (
  id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID                    REFERENCES public.purchases(id) ON DELETE SET NULL,
  buyer_id            UUID                    REFERENCES public.profiles(id)  ON DELETE SET NULL,
  seller_id           UUID                    REFERENCES public.profiles(id)  ON DELETE SET NULL,
  reason              dispute_reason_enum     NOT NULL,
  status              dispute_status_enum     NOT NULL DEFAULT 'AWAITING_SELLER',
  description         TEXT                    NOT NULL,
  desired_resolution  dispute_resolution_enum NOT NULL DEFAULT 'FULL_REFUND',

  -- Financial
  claimed_amount      DECIMAL(10,2)           NOT NULL DEFAULT 0,
  approved_amount     DECIMAL(10,2),

  -- Return logistics
  return_required     BOOLEAN                 NOT NULL DEFAULT FALSE,
  return_label_url    TEXT,
  return_tracking     TEXT,
  return_shipped_at   TIMESTAMPTZ,
  return_received_at  TIMESTAMPTZ,

  -- Large item / surfboard flag (for freight logistics)
  is_large_item       BOOLEAN                 NOT NULL DEFAULT FALSE,

  -- Surf-specific damage fields (stored as JSONB)
  damage_types        TEXT[]                  NOT NULL DEFAULT '{}',
  damage_during_shipping TEXT,  -- 'YES' | 'NO' | 'UNSURE'

  -- Seller partial proposal (awaiting buyer confirmation)
  seller_partial_amount DECIMAL(10,2),

  -- Notes
  admin_notes         TEXT,
  resolution_notes    TEXT,

  -- Timestamps
  created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,
  deadline_at         TIMESTAMPTZ             NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id   ON public.disputes (order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_buyer_id   ON public.disputes (buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_id  ON public.disputes (seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status     ON public.disputes (status);
CREATE INDEX IF NOT EXISTS idx_disputes_deadline   ON public.disputes (deadline_at) WHERE status NOT IN ('RESOLVED_REFUND','RESOLVED_NO_REFUND','RESOLVED_KEEP_ITEM','CLOSED');

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_admin_all"    ON public.disputes;
DROP POLICY IF EXISTS "disputes_buyer_read"   ON public.disputes;
DROP POLICY IF EXISTS "disputes_buyer_insert" ON public.disputes;
DROP POLICY IF EXISTS "disputes_buyer_update" ON public.disputes;
DROP POLICY IF EXISTS "disputes_seller_read"  ON public.disputes;
DROP POLICY IF EXISTS "disputes_seller_update" ON public.disputes;
DROP POLICY IF EXISTS "disputes_service_all"  ON public.disputes;

CREATE POLICY "disputes_admin_all" ON public.disputes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

CREATE POLICY "disputes_buyer_read" ON public.disputes
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "disputes_buyer_insert" ON public.disputes
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Buyers can update to add return tracking / accept partial
CREATE POLICY "disputes_buyer_update" ON public.disputes
  FOR UPDATE USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "disputes_seller_read" ON public.disputes
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "disputes_seller_update" ON public.disputes
  FOR UPDATE USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Service role for automated jobs (deadline enforcement, label generation)
CREATE POLICY "disputes_service_all" ON public.disputes
  FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- dispute_messages
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id          UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID                      NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id   UUID                      REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role dispute_sender_role_enum  NOT NULL,
  message     TEXT                      NOT NULL,
  attachments TEXT[]                    NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON public.dispute_messages (dispute_id, created_at);

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_admin_all"    ON public.dispute_messages;
DROP POLICY IF EXISTS "dm_participant_read" ON public.dispute_messages;
DROP POLICY IF EXISTS "dm_participant_insert" ON public.dispute_messages;

CREATE POLICY "dm_admin_all" ON public.dispute_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

-- Buyer and seller can read their dispute messages
CREATE POLICY "dm_participant_read" ON public.dispute_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_messages.dispute_id
        AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
    )
  );

CREATE POLICY "dm_participant_insert" ON public.dispute_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_messages.dispute_id
        AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
        AND d.status NOT IN ('RESOLVED_REFUND','RESOLVED_NO_REFUND','RESOLVED_KEEP_ITEM','CLOSED')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- dispute_evidence
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id          UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID                        NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  uploaded_by UUID                        REFERENCES public.profiles(id) ON DELETE SET NULL,
  type        dispute_evidence_type_enum  NOT NULL DEFAULT 'PHOTO',
  url         TEXT                        NOT NULL,
  caption     TEXT,
  created_at  TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON public.dispute_evidence (dispute_id);

ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "de_admin_all"           ON public.dispute_evidence;
DROP POLICY IF EXISTS "de_participant_read"    ON public.dispute_evidence;
DROP POLICY IF EXISTS "de_participant_insert"  ON public.dispute_evidence;

CREATE POLICY "de_admin_all" ON public.dispute_evidence
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

CREATE POLICY "de_participant_read" ON public.dispute_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_evidence.dispute_id
        AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
    )
  );

CREATE POLICY "de_participant_insert" ON public.dispute_evidence
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_evidence.dispute_id
        AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- dispute_flags  (internal — never exposed to buyer or seller)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dispute_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID        NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  flag_type   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_flags_dispute ON public.dispute_flags (dispute_id);

ALTER TABLE public.dispute_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "df_admin_all" ON public.dispute_flags;

CREATE POLICY "df_admin_all" ON public.dispute_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger for disputes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_disputes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS disputes_set_updated_at ON public.disputes;
CREATE TRIGGER disputes_set_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_disputes_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend notifications.type CHECK for dispute events
-- ─────────────────────────────────────────────────────────────────────────────

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
    'offer_expiring_soon',
    'new_listing_from_followed',
    'price_drop_from_followed',
    'dispute_opened',
    'dispute_seller_responded',
    'dispute_return_label_sent',
    'dispute_return_shipped',
    'dispute_return_received',
    'dispute_return_window_warning',
    'dispute_return_window_expired',
    'dispute_escalated',
    'dispute_refund_released',
    'dispute_resolved'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Count open disputes for a buyer in the last 90 days (fraud detection)
CREATE OR REPLACE FUNCTION public.buyer_disputes_in_90d(p_buyer_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.disputes
  WHERE buyer_id = p_buyer_id
    AND created_at >= NOW() - INTERVAL '90 days';
$$;
GRANT EXECUTE ON FUNCTION public.buyer_disputes_in_90d(uuid) TO authenticated, service_role;

-- Count distinct sellers a buyer has disputed against (fraud detection)
CREATE OR REPLACE FUNCTION public.buyer_distinct_seller_dispute_count(p_buyer_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT seller_id)::int
  FROM public.disputes
  WHERE buyer_id = p_buyer_id
    AND created_at >= NOW() - INTERVAL '90 days';
$$;
GRANT EXECUTE ON FUNCTION public.buyer_distinct_seller_dispute_count(uuid) TO authenticated, service_role;

-- Count disputes where buyer opened but never completed return (pattern detection)
CREATE OR REPLACE FUNCTION public.buyer_abandoned_returns(p_buyer_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.disputes
  WHERE buyer_id = p_buyer_id
    AND return_required = true
    AND status = 'CLOSED'
    AND return_received_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.buyer_abandoned_returns(uuid) TO authenticated, service_role;

-- Seller refund rate (disputes ended in RESOLVED_REFUND / total disputes against seller)
CREATE OR REPLACE FUNCTION public.seller_refund_rate(p_seller_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE status = 'RESOLVED_REFUND')::numeric /
        COUNT(*)::numeric, 4
      )
    END
  FROM public.disputes
  WHERE seller_id = p_seller_id;
$$;
GRANT EXECUTE ON FUNCTION public.seller_refund_rate(uuid) TO authenticated, service_role;
