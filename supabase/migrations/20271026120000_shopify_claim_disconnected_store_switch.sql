-- A disconnected Shopify connection still stores the previous shop, and
-- claim_shopify_pending_installation treated that row as a live link.
-- Disconnect only flips status, so the next claim of a different store raised
-- "Reswell account is linked to another Shopify store".
--
-- Any Reswell user can move a disconnected connection onto the shop in the
-- pending install. An active link to a different shop still has to disconnect
-- first. A shop another account is actively using stays blocked.
--
-- RETURNS TABLE creates connection_id, shop_domain, and shop_name variables.
-- #variable_conflict use_column keeps those names as table columns in SQL, so
-- the credential and pending-install updates do not raise
-- "column reference connection_id is ambiguous".
--
-- The later UPDATE rewrites shop identity, tokens, and status. Listings from
-- the previous store stay unpublished, and their sync jobs are canceled so a
-- post-claim retry cannot publish them again.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_shopify_pending_installation(
  p_claim_secret_hash text,
  p_user_id uuid
)
RETURNS TABLE (connection_id uuid, shop_domain text, shop_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_pending public.shopify_pending_installations%ROWTYPE;
  v_connection public.shopify_connections%ROWTYPE;
  v_credential_id uuid;
  v_has_connection boolean := false;
  v_shop_moved boolean := false;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  SELECT * INTO v_pending
  FROM public.shopify_pending_installations
  WHERE claim_secret_hash = p_claim_secret_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending Shopify installation not found';
  END IF;

  IF v_pending.status = 'claimed' THEN
    IF v_pending.claimed_by = p_user_id AND v_pending.connection_id IS NOT NULL THEN
      RETURN QUERY
      SELECT c.id, c.shop_domain, c.shop_name
      FROM public.shopify_connections c
      WHERE c.id = v_pending.connection_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Shopify installation was already claimed';
  END IF;

  IF v_pending.status <> 'ready' OR v_pending.expires_at <= now() THEN
    RAISE EXCEPTION 'Shopify installation is not ready or has expired';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.shopify_connect_enabled IS TRUE
  ) THEN
    RAISE EXCEPTION 'Reswell account is not approved for Shopify';
  END IF;

  -- The shop match and this account's row can be different connections.
  -- Lock both before deciding which one this claim may rewrite.
  PERFORM c.id
  FROM public.shopify_connections c
  WHERE c.shop_gid = v_pending.shop_gid
     OR lower(c.shop_domain) = lower(v_pending.shop_domain)
     OR c.user_id = p_user_id
  ORDER BY c.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.shopify_connections c
    WHERE c.user_id <> p_user_id
      AND c.status <> 'disconnected'
      AND (
        c.shop_gid = v_pending.shop_gid
        OR lower(c.shop_domain) = lower(v_pending.shop_domain)
      )
  ) THEN
    RAISE EXCEPTION 'Shopify store belongs to another Reswell account';
  END IF;

  SELECT * INTO v_connection
  FROM public.shopify_connections c
  WHERE c.user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    v_has_connection := true;
    v_shop_moved :=
      (v_connection.shop_gid IS NOT NULL AND v_connection.shop_gid <> v_pending.shop_gid)
      OR lower(v_connection.shop_domain) <> lower(v_pending.shop_domain);
    IF v_shop_moved AND v_connection.status = 'active' THEN
      RAISE EXCEPTION 'Reswell account is linked to another Shopify store';
    END IF;
  END IF;

  -- A disconnected row still occupies the unique shop domain. Release it so
  -- this claim can rewrite the caller's connection onto that shop.
  UPDATE public.shopify_connections c
  SET shop_gid = NULL,
      shop_domain = 'released-' || c.id::text,
      updated_at = now()
  WHERE c.user_id <> p_user_id
    AND c.status = 'disconnected'
    AND (
      c.shop_gid = v_pending.shop_gid
      OR lower(c.shop_domain) = lower(v_pending.shop_domain)
    );

  IF NOT v_has_connection THEN
    INSERT INTO public.shopify_connections (
      user_id,
      shop_gid,
      shop_domain,
      shop_name,
      status,
      sync_enabled,
      access_token_ciphertext,
      access_token_iv,
      access_token_tag,
      refresh_token_ciphertext,
      refresh_token_iv,
      refresh_token_tag,
      encryption_key_version,
      token_expires_at,
      refresh_token_expires_at,
      scopes,
      credential_provider,
      catalog_read_enabled,
      sales_enabled,
      inventory_write_enabled
    )
    VALUES (
      p_user_id,
      v_pending.shop_gid,
      lower(v_pending.shop_domain),
      v_pending.shop_name,
      'active',
      true,
      v_pending.access_token_ciphertext,
      v_pending.access_token_iv,
      v_pending.access_token_tag,
      v_pending.refresh_token_ciphertext,
      v_pending.refresh_token_iv,
      v_pending.refresh_token_tag,
      v_pending.encryption_key_version,
      v_pending.token_expires_at,
      v_pending.refresh_token_expires_at,
      v_pending.scopes,
      'public_oauth',
      true,
      true,
      true
    )
    RETURNING * INTO v_connection;
  ELSIF v_shop_moved THEN
    -- Disconnect already unpublished these listings. Do not publish them again
    -- when the same row is pointed at a different shop.
    UPDATE public.shopify_product_mappings AS mappings
    SET selected = false,
        sync_status = CASE
          WHEN mappings.sync_status = 'deleted' THEN mappings.sync_status
          ELSE 'unselected'
        END,
        updated_at = now()
    WHERE mappings.connection_id = v_connection.id
      AND mappings.selected IS TRUE;

    UPDATE public.listings l
    SET status = 'removed',
        stock_quantity = 0,
        updated_at = now()
    FROM public.shopify_product_mappings m
    WHERE m.connection_id = v_connection.id
      AND l.id = m.listing_id
      AND l.inventory_source = 'shopify'
      AND l.status <> 'removed';

    UPDATE public.shopify_sync_jobs AS jobs
    SET status = 'canceled',
        locked_until = NULL,
        worker_id = NULL,
        completed_at = now(),
        last_error = 'Canceled because this Reswell account connected a different Shopify store',
        updated_at = now()
    WHERE jobs.connection_id = v_connection.id
      AND jobs.status IN ('queued', 'retry', 'processing', 'dead');
  END IF;

  UPDATE public.shopify_credentials AS credentials
  SET status = 'retired',
      revoked_at = now(),
      updated_at = now()
  WHERE credentials.connection_id = v_connection.id
    AND credentials.status = 'active';

  INSERT INTO public.shopify_credentials (
    connection_id,
    provider,
    auth_mode,
    status,
    access_token_ciphertext,
    access_token_iv,
    access_token_tag,
    refresh_token_ciphertext,
    refresh_token_iv,
    refresh_token_tag,
    encryption_key_version,
    token_expires_at,
    refresh_token_expires_at,
    scopes,
    app_gid,
    app_installation_gid,
    last_verified_at
  )
  VALUES (
    v_connection.id,
    'public_oauth',
    'expiring_oauth',
    'active',
    v_pending.access_token_ciphertext,
    v_pending.access_token_iv,
    v_pending.access_token_tag,
    v_pending.refresh_token_ciphertext,
    v_pending.refresh_token_iv,
    v_pending.refresh_token_tag,
    v_pending.encryption_key_version,
    v_pending.token_expires_at,
    v_pending.refresh_token_expires_at,
    v_pending.scopes,
    v_pending.app_gid,
    v_pending.app_installation_gid,
    now()
  )
  RETURNING id INTO v_credential_id;

  UPDATE public.shopify_connections
  SET shop_gid = v_pending.shop_gid,
      shop_domain = lower(v_pending.shop_domain),
      shop_name = v_pending.shop_name,
      status = 'active',
      sync_enabled = true,
      access_token_ciphertext = v_pending.access_token_ciphertext,
      access_token_iv = v_pending.access_token_iv,
      access_token_tag = v_pending.access_token_tag,
      refresh_token_ciphertext = v_pending.refresh_token_ciphertext,
      refresh_token_iv = v_pending.refresh_token_iv,
      refresh_token_tag = v_pending.refresh_token_tag,
      encryption_key_version = v_pending.encryption_key_version,
      token_expires_at = v_pending.token_expires_at,
      refresh_token_expires_at = v_pending.refresh_token_expires_at,
      scopes = v_pending.scopes,
      active_credential_id = v_credential_id,
      credential_provider = 'public_oauth',
      catalog_read_enabled = true,
      sales_enabled = true,
      inventory_write_enabled = true,
      disconnected_at = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE id = v_connection.id;

  UPDATE public.shopify_pending_installations AS pending
  SET status = 'claimed',
      claimed_at = now(),
      claimed_by = p_user_id,
      connection_id = v_connection.id,
      access_token_ciphertext = NULL,
      access_token_iv = NULL,
      access_token_tag = NULL,
      refresh_token_ciphertext = NULL,
      refresh_token_iv = NULL,
      refresh_token_tag = NULL,
      updated_at = now()
  WHERE pending.id = v_pending.id;

  connection_id := v_connection.id;
  shop_domain := v_pending.shop_domain;
  shop_name := v_pending.shop_name;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_shopify_pending_installation(text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_shopify_pending_installation(text, uuid)
  TO service_role;

COMMIT;
