-- Purchase Protection System
-- Adds: purchase_protection_claims, protection_eligibility
-- (seller_protection_fund / seller_protection_contributions removed — see supabase/migrations)

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE claim_type_enum AS ENUM (
    'NOT_RECEIVED',
    'NOT_AS_DESCRIBED',
    'DAMAGED',
    'UNAUTHORIZED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'DENIED',
    'PAID_OUT',
    'WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_method_enum AS ENUM (
    'ORIGINAL_PAYMENT',
    'RESWELL_CREDIT',
    'BANK_TRANSFER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- protection_eligibility (one row per purchase, created on sale)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.protection_eligibility (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
  is_eligible  BOOLEAN        NOT NULL DEFAULT TRUE,
  reason       TEXT,
  window_closes TIMESTAMPTZ   NOT NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);

ALTER TABLE public.protection_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_admin_all"  ON public.protection_eligibility;
DROP POLICY IF EXISTS "pe_buyer_read" ON public.protection_eligibility;

CREATE POLICY "pe_admin_all" ON public.protection_eligibility
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

-- Buyer can read their own eligibility (join via purchases)
CREATE POLICY "pe_buyer_read" ON public.protection_eligibility
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = protection_eligibility.order_id
        AND p.buyer_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- purchase_protection_claims
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchase_protection_claims (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID             REFERENCES public.purchases(id)  ON DELETE SET NULL,
  buyer_id        UUID             REFERENCES public.profiles(id)   ON DELETE SET NULL,
  seller_id       UUID             REFERENCES public.profiles(id)   ON DELETE SET NULL,
  claim_type      claim_type_enum  NOT NULL,
  status          claim_status_enum NOT NULL DEFAULT 'PENDING',
  description     TEXT             NOT NULL,
  claimed_amount  DECIMAL(10, 2)   NOT NULL,
  approved_amount DECIMAL(10, 2),
  payout_method   payout_method_enum,
  denial_reason   TEXT,
  evidence_urls   TEXT[]           NOT NULL DEFAULT '{}',
  -- fraud flags (never exposed to buyer/seller)
  fraud_flags     TEXT[]           NOT NULL DEFAULT '{}',
  -- seller response
  seller_response TEXT,
  seller_responded_at TIMESTAMPTZ,
  -- admin
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID             REFERENCES public.profiles(id)   ON DELETE SET NULL,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE public.purchase_protection_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppc_admin_all"   ON public.purchase_protection_claims;
DROP POLICY IF EXISTS "ppc_buyer_read"  ON public.purchase_protection_claims;
DROP POLICY IF EXISTS "ppc_buyer_insert" ON public.purchase_protection_claims;
DROP POLICY IF EXISTS "ppc_seller_read" ON public.purchase_protection_claims;

-- Admins see everything
CREATE POLICY "ppc_admin_all" ON public.purchase_protection_claims
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR is_employee = true)
    )
  );

-- Buyers can read their own claims
CREATE POLICY "ppc_buyer_read" ON public.purchase_protection_claims
  FOR SELECT USING (buyer_id = auth.uid());

-- Buyers can insert (file a new claim)
CREATE POLICY "ppc_buyer_insert" ON public.purchase_protection_claims
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Sellers can read claims against their orders (no fraud_flags — redacted in app)
CREATE POLICY "ppc_seller_read" ON public.purchase_protection_claims
  FOR SELECT USING (seller_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ppc_order_id   ON public.purchase_protection_claims (order_id);
CREATE INDEX IF NOT EXISTS idx_ppc_buyer_id   ON public.purchase_protection_claims (buyer_id);
CREATE INDEX IF NOT EXISTS idx_ppc_seller_id  ON public.purchase_protection_claims (seller_id);
CREATE INDEX IF NOT EXISTS idx_ppc_status     ON public.purchase_protection_claims (status);
CREATE INDEX IF NOT EXISTS idx_pe_order_id    ON public.protection_eligibility (order_id);
