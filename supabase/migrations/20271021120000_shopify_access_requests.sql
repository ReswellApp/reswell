-- Merchant-requested Shopify plugin access. Approval remains admin-only.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shopify_connect_requested_at timestamptz;

COMMENT ON COLUMN public.profiles.shopify_connect_requested_at IS
  'When the merchant last asked Reswell to enable Shopify plugin access. Does not grant access.';

REVOKE UPDATE (shopify_connect_requested_at)
  ON public.profiles FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.shopify_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_domain text,
  shop_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'granted', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shopify_access_requests_one_pending_idx
  ON public.shopify_access_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS shopify_access_requests_user_idx
  ON public.shopify_access_requests (user_id, created_at DESC);

ALTER TABLE public.shopify_access_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.shopify_access_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_access_requests TO service_role;

COMMIT;
