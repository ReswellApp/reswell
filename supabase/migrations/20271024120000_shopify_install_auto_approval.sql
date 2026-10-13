-- Approve Shopify plugin access for an account that completes a signed Shopify
-- install. Finishing Shopify OAuth already proves the merchant administers the
-- store, so the claim can grant access instead of waiting on an admin.
-- An admin revocation blocks auto-approval until an admin grants access again.
-- Manual setup (shopify_manual_canary_enabled) stays admin-only.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shopify_connect_revoked_at timestamptz;

COMMENT ON COLUMN public.profiles.shopify_connect_revoked_at IS
  'Set when an admin revokes Shopify access. Blocks auto-approval from Shopify installs until an admin grants access again.';

REVOKE UPDATE (shopify_connect_revoked_at)
  ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_shopify_install_claimant(
  p_claim_secret_hash text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.shopify_pending_installations%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  SELECT * INTO v_pending
  FROM public.shopify_pending_installations
  WHERE claim_secret_hash = p_claim_secret_hash;

  IF NOT FOUND
     OR v_pending.status <> 'ready'
     OR v_pending.expires_at <= now()
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shopify_connections c
    WHERE (c.shop_gid = v_pending.shop_gid
           OR lower(c.shop_domain) = lower(v_pending.shop_domain))
      AND c.user_id <> p_user_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET shopify_connect_enabled = true
  WHERE id = p_user_id
    AND shopify_connect_enabled IS NOT TRUE
    AND shopify_connect_revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_user_id AND p.shopify_connect_enabled IS TRUE
    );
  END IF;

  UPDATE public.shopify_access_requests
  SET status = 'granted',
      shop_domain = coalesce(shop_domain, lower(v_pending.shop_domain)),
      shop_name = coalesce(shop_name, v_pending.shop_name),
      updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    INSERT INTO public.shopify_access_requests (
      user_id,
      shop_domain,
      shop_name,
      status
    )
    VALUES (
      p_user_id,
      lower(v_pending.shop_domain),
      v_pending.shop_name,
      'granted'
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_shopify_install_claimant(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shopify_install_claimant(text, uuid)
  TO service_role;

COMMIT;
