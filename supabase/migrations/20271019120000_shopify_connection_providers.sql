-- Shopify public-install claims and replaceable credential providers.
-- Product mappings and sync jobs continue to reference one stable connection.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shopify_manual_canary_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.shopify_manual_canary_enabled IS
  'Admin-only allowlist for one-store merchant-owned Dev Dashboard credential pilots.';

REVOKE UPDATE (shopify_manual_canary_enabled)
  ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.profiles_guard_shopify_manual_canary_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shopify_manual_canary_enabled IS DISTINCT FROM OLD.shopify_manual_canary_enabled
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.is_admin IS TRUE
     )
  THEN
    NEW.shopify_manual_canary_enabled := OLD.shopify_manual_canary_enabled;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_shopify_manual_canary_privilege_trigger
  ON public.profiles;
CREATE TRIGGER profiles_guard_shopify_manual_canary_privilege_trigger
  BEFORE UPDATE OF shopify_manual_canary_enabled ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_shopify_manual_canary_privilege();

ALTER TABLE public.shopify_oauth_states
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS flow_type text NOT NULL DEFAULT 'account_oauth',
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.shopify_connections(id)
    ON DELETE CASCADE;

ALTER TABLE public.shopify_oauth_states
  DROP CONSTRAINT IF EXISTS shopify_oauth_states_flow_type_check;
ALTER TABLE public.shopify_oauth_states
  ADD CONSTRAINT shopify_oauth_states_flow_type_check
  CHECK (flow_type IN ('account_oauth', 'public_install'));

ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS shop_gid text,
  ADD COLUMN IF NOT EXISTS credential_provider text NOT NULL DEFAULT 'public_oauth',
  ADD COLUMN IF NOT EXISTS catalog_read_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inventory_write_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS active_credential_id uuid;

ALTER TABLE public.shopify_connections
  DROP CONSTRAINT IF EXISTS shopify_connections_provider_check;
ALTER TABLE public.shopify_connections
  ADD CONSTRAINT shopify_connections_provider_check
  CHECK (credential_provider IN ('public_oauth', 'merchant_custom'));

CREATE UNIQUE INDEX IF NOT EXISTS shopify_connections_shop_gid_uidx
  ON public.shopify_connections (shop_gid)
  WHERE shop_gid IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.shopify_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.shopify_connections(id)
    ON DELETE CASCADE,
  provider text NOT NULL
    CHECK (provider IN ('public_oauth', 'merchant_custom')),
  auth_mode text NOT NULL
    CHECK (auth_mode IN ('expiring_oauth', 'client_credentials')),
  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'active', 'grace', 'retired', 'revoked')),
  client_id_ciphertext text,
  client_id_iv text,
  client_id_tag text,
  client_secret_ciphertext text,
  client_secret_iv text,
  client_secret_tag text,
  access_token_ciphertext text NOT NULL,
  access_token_iv text NOT NULL,
  access_token_tag text NOT NULL,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  encryption_key_version integer NOT NULL DEFAULT 1,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  app_gid text,
  app_installation_gid text,
  webhook_route_key text NOT NULL UNIQUE
    DEFAULT replace(gen_random_uuid()::text, '-', ''),
  last_verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shopify_credentials_one_active_idx
  ON public.shopify_credentials (connection_id)
  WHERE status = 'active';

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
  last_verified_at
)
SELECT
  c.id,
  'public_oauth',
  'expiring_oauth',
  'active',
  c.access_token_ciphertext,
  c.access_token_iv,
  c.access_token_tag,
  c.refresh_token_ciphertext,
  c.refresh_token_iv,
  c.refresh_token_tag,
  c.encryption_key_version,
  c.token_expires_at,
  c.refresh_token_expires_at,
  c.scopes,
  coalesce(c.last_reconciled_at, c.connected_at)
FROM public.shopify_connections c
WHERE NOT EXISTS (
  SELECT 1 FROM public.shopify_credentials sc
  WHERE sc.connection_id = c.id AND sc.status = 'active'
);

UPDATE public.shopify_connections c
SET active_credential_id = sc.id,
    credential_provider = sc.provider,
    updated_at = now()
FROM public.shopify_credentials sc
WHERE sc.connection_id = c.id
  AND sc.status = 'active'
  AND c.active_credential_id IS NULL;

ALTER TABLE public.shopify_connections
  DROP CONSTRAINT IF EXISTS shopify_connections_active_credential_fkey;
ALTER TABLE public.shopify_connections
  ADD CONSTRAINT shopify_connections_active_credential_fkey
  FOREIGN KEY (active_credential_id)
  REFERENCES public.shopify_credentials(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.shopify_pending_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_gid text NOT NULL,
  shop_domain text NOT NULL UNIQUE,
  shop_name text,
  status text NOT NULL DEFAULT 'registering'
    CHECK (status IN ('registering', 'ready', 'error', 'claimed')),
  access_token_ciphertext text,
  access_token_iv text,
  access_token_tag text,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  encryption_key_version integer NOT NULL DEFAULT 1,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  app_gid text,
  app_installation_gid text,
  claim_secret_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.shopify_connections(id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopify_pending_installations_status_expiry_idx
  ON public.shopify_pending_installations (status, expires_at);

ALTER TABLE public.shopify_webhook_events
  ADD COLUMN IF NOT EXISTS credential_id uuid
    REFERENCES public.shopify_credentials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS shopify_webhook_events_event_uidx
  ON public.shopify_webhook_events (shop_domain, topic, event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE public.shopify_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_pending_installations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.shopify_credentials FROM anon, authenticated;
REVOKE ALL ON public.shopify_pending_installations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_pending_installations TO service_role;

CREATE OR REPLACE FUNCTION public.claim_shopify_pending_installation(
  p_claim_secret_hash text,
  p_user_id uuid
)
RETURNS TABLE (connection_id uuid, shop_domain text, shop_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.shopify_pending_installations%ROWTYPE;
  v_connection public.shopify_connections%ROWTYPE;
  v_credential_id uuid;
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

  SELECT * INTO v_connection
  FROM public.shopify_connections c
  WHERE c.shop_gid = v_pending.shop_gid
     OR lower(c.shop_domain) = lower(v_pending.shop_domain)
     OR c.user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_connection.user_id <> p_user_id THEN
      RAISE EXCEPTION 'Shopify store belongs to another Reswell account';
    END IF;
    IF v_connection.shop_gid IS NOT NULL
       AND v_connection.shop_gid <> v_pending.shop_gid THEN
      RAISE EXCEPTION 'Reswell account is linked to another Shopify store';
    END IF;
    IF lower(v_connection.shop_domain) <> lower(v_pending.shop_domain) THEN
      RAISE EXCEPTION 'Reswell account is linked to another Shopify domain';
    END IF;
  ELSE
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
  END IF;

  UPDATE public.shopify_credentials
  SET status = 'retired',
      revoked_at = now(),
      updated_at = now()
  WHERE connection_id = v_connection.id
    AND status = 'active';

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

  UPDATE public.shopify_pending_installations
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
  WHERE id = v_pending.id;

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

CREATE OR REPLACE FUNCTION public.record_shopify_listing_sale(
  p_order_id uuid,
  p_listing_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mapping public.shopify_product_mappings%ROWTYPE;
  v_job_id uuid;
  v_quantity integer := GREATEST(1, coalesce(p_quantity, 1));
  v_inventory_source text;
BEGIN
  SELECT inventory_source INTO v_inventory_source
  FROM public.listings
  WHERE id = p_listing_id;

  IF v_inventory_source IS DISTINCT FROM 'shopify' THEN
    RETURN false;
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required for Shopify inventory sales';
  END IF;

  SELECT m.* INTO v_mapping
  FROM public.shopify_product_mappings m
  JOIN public.shopify_connections c ON c.id = m.connection_id
  JOIN public.listings l ON l.id = m.listing_id
  WHERE m.listing_id = p_listing_id
    AND m.selected IS TRUE
    AND c.status = 'active'
    AND c.sync_enabled IS TRUE
    AND c.sales_enabled IS TRUE
    AND c.inventory_write_enabled IS TRUE
    AND l.inventory_source = 'shopify'
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shopify-managed listing % is not enabled for sales', p_listing_id;
  END IF;

  INSERT INTO public.shopify_sync_jobs (
    connection_id, job_type, payload, idempotency_key
  )
  VALUES (
    v_mapping.connection_id,
    'inventory_decrement',
    jsonb_build_object(
      'mappingId', v_mapping.id,
      'listingId', p_listing_id,
      'orderId', p_order_id,
      'quantity', v_quantity
    ),
    format('sale:%s:%s', p_order_id, p_listing_id)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN RETURN false; END IF;

  UPDATE public.shopify_product_mappings
  SET inventory_generation = inventory_generation + 1,
      updated_at = now()
  WHERE id = v_mapping.id;

  UPDATE public.listings
  SET stock_quantity = GREATEST(0, stock_quantity - v_quantity),
      status = CASE
        WHEN stock_quantity - v_quantity <= 0 THEN 'removed'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_listing_id
    AND inventory_source = 'shopify'
    AND stock_quantity >= v_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shopify-managed listing % has insufficient local stock', p_listing_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_shopify_listing_sale(uuid, uuid, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_shopify_listing_sale(uuid, uuid, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.apply_shopify_inventory_projection(
  p_mapping_ids uuid[],
  p_remote_stock integer,
  p_expected_generation bigint,
  p_exclude_job_id uuid DEFAULT NULL
)
RETURNS TABLE (listing_id uuid, projected_stock integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mapping public.shopify_product_mappings%ROWTYPE;
  v_pending integer;
  v_projected integer;
  v_sales_enabled boolean;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  FOR v_mapping IN
    SELECT * FROM public.shopify_product_mappings
    WHERE id = ANY(p_mapping_ids)
    FOR UPDATE
  LOOP
    IF v_mapping.inventory_generation <> p_expected_generation THEN
      listing_id := v_mapping.listing_id;
      SELECT stock_quantity INTO projected_stock
      FROM public.listings WHERE id = v_mapping.listing_id;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT c.sales_enabled INTO v_sales_enabled
    FROM public.shopify_connections c
    WHERE c.id = v_mapping.connection_id;

    SELECT coalesce(sum(
      GREATEST(1, coalesce((j.payload ->> 'quantity')::integer, 1))
    ), 0)::integer
    INTO v_pending
    FROM public.shopify_sync_jobs j
    WHERE j.job_type = 'inventory_decrement'
      AND j.status IN ('queued', 'retry', 'processing', 'dead')
      AND j.payload ->> 'mappingId' = v_mapping.id::text
      AND (p_exclude_job_id IS NULL OR j.id <> p_exclude_job_id);

    v_projected := GREATEST(0, coalesce(p_remote_stock, 0) - v_pending);

    UPDATE public.listings
    SET stock_quantity = v_projected,
        status = CASE
          WHEN v_projected > 0 AND coalesce(v_sales_enabled, false)
            THEN 'active'
          ELSE 'removed'
        END,
        updated_at = now()
    WHERE id = v_mapping.listing_id
      AND inventory_source = 'shopify';

    UPDATE public.shopify_product_mappings
    SET sync_status = CASE
          WHEN v_projected > 0 THEN 'synced'
          ELSE 'out_of_stock'
        END,
        last_synced_at = now(),
        last_error = NULL,
        updated_at = now()
    WHERE id = v_mapping.id;

    listing_id := v_mapping.listing_id;
    projected_stock := v_projected;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_shopify_inventory_projection(
  uuid[], integer, bigint, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_shopify_inventory_projection(
  uuid[], integer, bigint, uuid
) TO service_role;

COMMIT;
