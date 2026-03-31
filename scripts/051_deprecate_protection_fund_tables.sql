-- Deprecate seller_protection_fund and seller_protection_contributions
-- 
-- Context: Reswell no longer charges sellers a 2% protection fund contribution.
-- Buyer protection is funded entirely from Reswell's 7% platform fee.
-- Sellers keep 93% of their sale price — one simple fee, nothing else withheld.
--
-- The purchase_protection_claims and protection_eligibility tables are KEPT
-- because buyer protection still exists — it is just funded differently.
--
-- These tables are deprecated (not dropped) to preserve historical data.
-- They can be dropped in a future migration once all references are confirmed removed.

-- ─────────────────────────────────────────────────────────────
-- Deprecate seller_protection_contributions
-- (2% per-sale withholding — no longer collected)
-- ─────────────────────────────────────────────────────────────

-- Add deprecation marker column (non-breaking)
ALTER TABLE public.seller_protection_contributions
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON TABLE public.seller_protection_contributions IS
  'DEPRECATED as of 2026-03 — Reswell no longer withholds a 2% protection fund contribution from sellers. Buyer protection is funded from the 7% platform fee. This table is kept for historical records only. Do not write new rows.';

-- ─────────────────────────────────────────────────────────────
-- Deprecate seller_protection_fund
-- (singleton balance ledger — no longer relevant)
-- ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.seller_protection_fund IS
  'DEPRECATED as of 2026-03 — The seller-funded protection pool is discontinued. Buyer protection is now funded entirely from Reswell''s 7% platform fee. This table is kept for historical records. Do not write new rows or reference the balance in application logic.';
