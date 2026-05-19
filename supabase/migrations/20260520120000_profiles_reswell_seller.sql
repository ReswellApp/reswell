-- Reswell Sellers: trusted sellers with 0% marketplace fee (full item payout).
-- Does not grant admin or employee access.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_reswell_seller boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_reswell_seller IS
  'When true, marketplace fee is waived on peer sales; seller receives 100% of item price. No admin privileges.';
