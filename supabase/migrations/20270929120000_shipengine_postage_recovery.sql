-- Ledger + run history for unused ShipEngine postage recovery.
-- Voids credit the ShipEngine balance (or close Reswell's own UPS invoice).
-- This job never refunds the buyer.

CREATE TABLE IF NOT EXISTS public.shipengine_label_void_ledger (
  label_id text PRIMARY KEY,
  tracking_number text,
  carrier_code text,
  carrier_id text,
  service_code text,
  is_return_label boolean NOT NULL DEFAULT false,
  label_created_at timestamptz,
  postage_usd numeric(12, 2) NOT NULL DEFAULT 0,
  insurance_usd numeric(12, 2) NOT NULL DEFAULT 0,
  order_id uuid,
  disposition text NOT NULL,
  recovery_kind text NOT NULL DEFAULT 'none',
  scan_status_code text,
  admin_void_requested boolean NOT NULL DEFAULT false,
  void_approved boolean,
  shipengine_voided boolean NOT NULL DEFAULT false,
  void_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  last_audited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shipengine_label_void_ledger_disposition_chk CHECK (
    disposition IN (
      'in_grace',
      'approaching',
      'scanned_keep',
      'voided_balance',
      'voided_ups_account',
      'voided_unconfirmed_billing',
      'void_denied',
      'expired_unrecoverable',
      'scan_unconfirmed',
      'refund_pending',
      'void_skipped'
    )
  ),
  CONSTRAINT shipengine_label_void_ledger_recovery_kind_chk CHECK (
    recovery_kind IN ('balance', 'ups_account', 'unknown_billing', 'none')
  )
);

CREATE INDEX IF NOT EXISTS shipengine_label_void_ledger_disposition_idx
  ON public.shipengine_label_void_ledger (disposition, label_created_at DESC);

CREATE INDEX IF NOT EXISTS shipengine_label_void_ledger_admin_open_idx
  ON public.shipengine_label_void_ledger (admin_void_requested, shipengine_voided);

COMMENT ON TABLE public.shipengine_label_void_ledger IS
  'Latest postage-recovery state per ShipEngine label. Auto-void at 20 days unscanned credits ShipEngine balance. Does not refund buyers.';

ALTER TABLE public.shipengine_label_void_ledger ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shipengine_postage_recovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now(),
  auto_void_enabled boolean NOT NULL,
  truncated boolean NOT NULL DEFAULT false,
  listed_count integer NOT NULL DEFAULT 0,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipengine_postage_recovery_runs_finished_idx
  ON public.shipengine_postage_recovery_runs (finished_at DESC);

COMMENT ON TABLE public.shipengine_postage_recovery_runs IS
  'Each unused-label audit. result.buyerRefundsIssued is always 0.';

ALTER TABLE public.shipengine_postage_recovery_runs ENABLE ROW LEVEL SECURITY;
