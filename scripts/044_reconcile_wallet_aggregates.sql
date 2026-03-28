-- Fix corrupted wallet rows where lifetime_cashed_out went negative (e.g. bad manual SQL)
-- or balance drifted from: earned - spent - max(0, cashed_out).
-- Safe to run once in Supabase SQL Editor (postgres / service role).

UPDATE public.wallets w
SET
  lifetime_cashed_out = greatest(0, coalesce(w.lifetime_cashed_out, 0)::numeric)::numeric(10, 2),
  balance = (
    greatest(0, coalesce(w.lifetime_earned, 0)::numeric)
    - greatest(0, coalesce(w.lifetime_spent, 0)::numeric)
    - greatest(0, coalesce(w.lifetime_cashed_out, 0)::numeric)
  )::numeric(10, 2),
  updated_at = now()
WHERE
  coalesce(w.lifetime_cashed_out, 0)::numeric < 0
  OR abs(
    coalesce(w.balance, 0)::numeric
    - (
      greatest(0, coalesce(w.lifetime_earned, 0)::numeric)
      - greatest(0, coalesce(w.lifetime_spent, 0)::numeric)
      - greatest(0, coalesce(w.lifetime_cashed_out, 0)::numeric)
    )
  ) > 0.02;
