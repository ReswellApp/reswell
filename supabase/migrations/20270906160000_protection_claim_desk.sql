-- Purchase Protection claim desk: carrier/insurance claim tracking, evidence,
-- repair credits, and ParcelGuard fields on marketplace labels.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Order support requests — carrier claim + repair credit summary
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_support_requests
  ADD COLUMN IF NOT EXISTS carrier_claim_status text,
  ADD COLUMN IF NOT EXISTS carrier_claim_id text,
  ADD COLUMN IF NOT EXISTS carrier_claim_url text,
  ADD COLUMN IF NOT EXISTS insurance_claim_url text,
  ADD COLUMN IF NOT EXISTS repair_credit_total numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_credit_last_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_support_requests_carrier_claim_status_check'
  ) THEN
    ALTER TABLE public.order_support_requests
      ADD CONSTRAINT order_support_requests_carrier_claim_status_check
      CHECK (
        carrier_claim_status IS NULL
        OR carrier_claim_status IN (
          'not_started',
          'ready_to_file',
          'filed',
          'under_review',
          'approved',
          'denied',
          'paid',
          'withdrawn'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.order_support_requests.carrier_claim_status IS
  'Ops tracking for UPS/FedEx/ParcelGuard damage or loss claim (not auto-filed via API).';
COMMENT ON COLUMN public.order_support_requests.insurance_claim_url IS
  'ShipEngine ParcelGuard / Shipsurance claim portal URL when insurance was purchased with the label.';
COMMENT ON COLUMN public.order_support_requests.repair_credit_total IS
  'Sum of Purchase Protection repair credits granted to the buyer wallet for this case.';

-- ---------------------------------------------------------------------------
-- 2) Evidence attachments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_case_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_support_request_id uuid NOT NULL REFERENCES public.order_support_requests (id) ON DELETE CASCADE,
  support_case_id uuid REFERENCES public.support_cases (id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  evidence_kind text NOT NULL DEFAULT 'damage',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_case_attachments_evidence_kind_check CHECK (evidence_kind IN (
    'damage', 'packing', 'listing_compare', 'other'
  )),
  CONSTRAINT support_case_attachments_mime_check CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
  )),
  CONSTRAINT support_case_attachments_size_check CHECK (size_bytes > 0 AND size_bytes <= 20971520)
);

CREATE INDEX IF NOT EXISTS support_case_attachments_request_idx
  ON public.support_case_attachments (order_support_request_id, created_at ASC);

CREATE INDEX IF NOT EXISTS support_case_attachments_uploader_idx
  ON public.support_case_attachments (uploaded_by, created_at DESC);

ALTER TABLE public.support_case_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_case_attachments_select_own ON public.support_case_attachments;
CREATE POLICY support_case_attachments_select_own ON public.support_case_attachments
  FOR SELECT
  TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.order_support_requests r
      WHERE r.id = order_support_request_id
        AND r.buyer_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

DROP POLICY IF EXISTS support_case_attachments_insert_own ON public.support_case_attachments;
CREATE POLICY support_case_attachments_insert_own ON public.support_case_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-case-attachments',
  'support-case-attachments',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "support_case_attachments_storage_insert_own" ON storage.objects;
CREATE POLICY "support_case_attachments_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-case-attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "support_case_attachments_storage_select_own" ON storage.objects;
CREATE POLICY "support_case_attachments_storage_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-case-attachments'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND (p.is_admin = true OR p.is_employee = true)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Label insurance fields (ParcelGuard / carrier)
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_shipping_labels
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insured_value_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS insured_value_currency text,
  ADD COLUMN IF NOT EXISTS insurance_cost_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS insurance_claim_url text,
  ADD COLUMN IF NOT EXISTS shipengine_label_id text,
  ADD COLUMN IF NOT EXISTS shipengine_shipment_id text;

COMMENT ON COLUMN public.order_shipping_labels.insurance_claim_url IS
  'Pre-filled ShipEngine insurance claim portal URL from the label purchase response.';

-- ---------------------------------------------------------------------------
-- 4) Wallet ledger: protection repair credit (+ return refund if missing)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_reference_type_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions
      DROP CONSTRAINT wallet_transactions_reference_type_check;
  END IF;

  ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_reference_type_check
    CHECK (
      reference_type IS NULL
      OR reference_type IN (
        'listing',
        'order_pending_earnings',
        'order_seller_earnings',
        'stripe_refund',
        'wallet_refund',
        'stripe_connect_transfer',
        'paypal_payout',
        'shipping_fee_correction',
        'consignment_order_pending_consignor',
        'consignment_order_pending_shop',
        'consignment_order_consignor_earnings',
        'consignment_order_shop_commission',
        'consignment_order_refund_consignor',
        'consignment_order_refund_shop',
        'seller_shipping_label',
        'seller_flat_shipping_surplus',
        'admin_terminal_cash_wallet_correction',
        'board_buy_payout',
        'order_item_return_refund',
        'protection_repair_credit'
      )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_protection_repair_credit_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'protection_repair_credit';

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_order_item_return_refund_uidx
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'order_item_return_refund';

-- Seed claim-desk macros (idempotent by title)
INSERT INTO public.support_macros (title, body, kind_filter, is_active, sort_order)
SELECT v.title, v.body, v.kind_filter, true, v.sort_order
FROM (VALUES
  (
    'Request damage photos',
    E'Thanks for reaching out. To review your Purchase Protection claim, please reply with clear photos of:\n1) The damage to the item\n2) The packing / box as it arrived\n3) Any carrier label still on the package\n\nOnce we have those, we''ll decide between a repair credit, a return + refund, or next steps with the carrier.',
    'protection_claim',
    10
  ),
  (
    'Offer repair credit',
    E'We''re sorry the board arrived damaged. If you''d rather keep it and repair locally, we can credit your Reswell wallet toward the repair. Reply with an estimate (or shop quote) and we''ll apply a credit on this case.',
    'protection_claim',
    11
  ),
  (
    'Carrier claim filed',
    E'We''ve filed a damage claim with the carrier / insurance for this shipment. We''ll update you when we hear back. Your Purchase Protection case stays open — you can reply here anytime.',
    'protection_claim',
    12
  )
) AS v(title, body, kind_filter, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_macros m WHERE m.title = v.title
);

COMMIT;
