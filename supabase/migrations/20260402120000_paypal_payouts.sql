-- PayPal Payouts: saved email on profile + payout audit rows.
-- NOTE: This app uses public.profiles (not a "users" table) for profile fields.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paypal_email text;

CREATE TABLE IF NOT EXISTS public.paypal_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  paypal_email text NOT NULL,
  paypal_batch_id text,
  paypal_payout_id text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (
      status IN (
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'FAILED',
        'UNCLAIMED'
      )
    ),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paypal_payouts_user_created_idx
  ON public.paypal_payouts (user_id, created_at DESC);

ALTER TABLE public.paypal_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own paypal payouts" ON public.paypal_payouts;
CREATE POLICY "Users see own paypal payouts"
  ON public.paypal_payouts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own paypal payouts" ON public.paypal_payouts;
CREATE POLICY "Users insert own paypal payouts"
  ON public.paypal_payouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Restore wallet funds when PayPal rejects a payout (called from webhook with service role).
-- Seller available balance lives in public.wallets in this codebase.
CREATE OR REPLACE FUNCTION public.refund_to_available_balance (
  p_user_id uuid,
  p_amount numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wallets w
  SET
    balance = w.balance + p_amount,
    lifetime_cashed_out = GREATEST(0::numeric, w.lifetime_cashed_out - p_amount),
    updated_at = now()
  WHERE w.user_id = p_user_id;
END;
$$;
