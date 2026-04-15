-- One-time reset: zero Reswell Bucks for every user and clear ledger / payout history.
-- Run manually in the Supabase SQL editor (or psql) with a role that bypasses RLS, after
-- switching to a new Stripe platform account.
--
-- DELETE steps use to_regclass() so missing tables (e.g. PayPal not deployed on this DB) are skipped.
--
-- What this does:
--   - Sets all wallet aggregates to 0 (balance, lifetime_earned, lifetime_spent, lifetime_cashed_out)
--   - Deletes all wallet_transactions (activity feed), when present
--   - Deletes stripe_connect_transfers / stripe_connect_accounts when present
--   - Deletes paypal_payouts when present (PayPal payout history in Earnings)
--
-- What it does not do:
--   - Does not delete orders, listings, or profile PayPal fields.
--
-- Refunds / clawbacks: if old PaymentIntents can still refund against a prior Stripe account,
-- webhook logic may post new wallet rows after this reset. Freeze or close the old Stripe
-- platform account if you must avoid that.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.wallet_transactions';
  END IF;
  IF to_regclass('public.stripe_connect_transfers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.stripe_connect_transfers';
  END IF;
  IF to_regclass('public.paypal_payouts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.paypal_payouts';
  END IF;
  IF to_regclass('public.stripe_connect_accounts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.stripe_connect_accounts';
  END IF;
END $$;

UPDATE public.wallets
SET
  balance = 0,
  lifetime_earned = 0,
  lifetime_spent = 0,
  lifetime_cashed_out = 0,
  updated_at = now();

COMMIT;
