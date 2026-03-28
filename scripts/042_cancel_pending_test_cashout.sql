-- Cancel a mistaken / test pending cash-out (restores wallet, removes request + ledger line).
-- Your UI "Pending Cash-outs" row is cashout_requests + a wallet_transactions row (type cashout),
-- not a purchases row. For cash-out + underlying test sale + balance, use
-- scripts/043_remove_test_sale_and_cashout_complete.sql instead.
--
-- Run in Supabase SQL Editor (postgres or service role).

-- ---------------------------------------------------------------------------
-- STEP 1 — Run alone. Confirm exactly one row (note id + wallet_id).
-- ---------------------------------------------------------------------------
-- SELECT cr.id, cr.status, cr.amount, cr.fee, cr.net_amount, cr.payment_method, cr.payment_email,
--        cr.wallet_id, cr.user_id, cr.created_at
-- FROM public.cashout_requests cr
-- WHERE cr.status IN ('pending', 'processing')
--   AND cr.amount::numeric = 828.00
--   AND cr.payment_method = 'venmo'
--   AND cr.payment_email ILIKE '%haydengarfield%'
-- ORDER BY cr.created_at DESC;

BEGIN;

CREATE TEMP TABLE _cancel_cashout ON COMMIT DROP AS
SELECT cr.id AS cashout_id,
       cr.wallet_id,
       cr.amount::numeric AS amount,
       cr.user_id
FROM public.cashout_requests cr
WHERE cr.status IN ('pending', 'processing')
  AND cr.amount::numeric = 828.00
  AND cr.payment_method = 'venmo'
  AND cr.payment_email ILIKE '%haydengarfield%'
ORDER BY cr.created_at DESC
LIMIT 1;

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*)::int INTO n FROM _cancel_cashout;
  IF n = 0 THEN
    RAISE EXCEPTION
      'No matching pending cash-out. Run STEP 1 SELECT; adjust amount / venmo / email filters, or cancel by id (see script footer).';
  END IF;
END $$;

-- Restore funds (cash-out had deducted full amount from balance and bumped lifetime_cashed_out).
UPDATE public.wallets w
SET
  balance = (w.balance::numeric + c.amount)::numeric(10, 2),
  lifetime_cashed_out = (w.lifetime_cashed_out::numeric - c.amount)::numeric(10, 2),
  updated_at = now()
FROM _cancel_cashout c
WHERE w.id = c.wallet_id;

DELETE FROM public.wallet_transactions wt
USING _cancel_cashout c
WHERE wt.reference_id::text = c.cashout_id::text
  AND wt.type = 'cashout';

DELETE FROM public.cashout_requests cr
USING _cancel_cashout c
WHERE cr.id = c.cashout_id;

COMMIT;

-- ---------------------------------------------------------------------------
-- Manual one-off (if filters do not match): run inside a transaction, replace UUIDs.
-- ---------------------------------------------------------------------------
-- UPDATE public.wallets
-- SET balance = (balance::numeric + 828.00)::numeric(10, 2),
--     lifetime_cashed_out = (lifetime_cashed_out::numeric - 828.00)::numeric(10, 2),
--     updated_at = now()
-- WHERE id = 'WALLET-UUID';
-- DELETE FROM public.wallet_transactions
-- WHERE reference_id::text = 'CASHOUT-REQUEST-UUID' AND type = 'cashout';
-- DELETE FROM public.cashout_requests WHERE id = 'CASHOUT-REQUEST-UUID';
