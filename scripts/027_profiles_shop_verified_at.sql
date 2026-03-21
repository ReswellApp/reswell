-- When a seller is verified, we record the time for "recently verified" homepage ordering.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_verified_at TIMESTAMPTZ;

-- Approximate past verifications (optional; remove if you prefer NULL until next toggle)
UPDATE public.profiles
SET shop_verified_at = COALESCE(shop_verified_at, updated_at)
WHERE shop_verified = true;

COMMENT ON COLUMN public.profiles.shop_verified_at IS 'Set when shop_verified is granted; cleared when revoked.';
