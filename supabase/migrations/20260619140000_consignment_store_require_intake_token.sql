-- ─────────────────────────────────────────────────────────────────────────────
-- Decouple "has an intake QR token" from "requires the token to consign".
-- Previously, generating a QR token implicitly locked the bare /consign URL. That made
-- merely opening the QR page silently break direct consign links for a store.
-- This flag makes QR-gating an explicit, owner-controlled choice; default is open intake,
-- so every existing store keeps working exactly as before until a shop opts in.
-- Additive + idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.consignment_stores
  ADD COLUMN IF NOT EXISTS require_intake_token boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.consignment_stores.require_intake_token IS
  'When true, /consign requires the store intake_qr_token (scan the in-store QR). When false (default), any signed-in user can consign to this active store.';
