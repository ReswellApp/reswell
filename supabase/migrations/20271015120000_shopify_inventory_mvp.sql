-- Shopify inventory-channel MVP.
-- Shopify owns product, variant, and inventory truth. Reswell owns checkout.
-- Credentials and sync state are service-role only; merchants interact through
-- authenticated server routes.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shopify_connect_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.shopify_connect_enabled IS
  'Admin-controlled eligibility for the Reswell Shopify inventory integration.';

REVOKE UPDATE (shopify_connect_enabled) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.profiles_guard_shopify_connect_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shopify_connect_enabled IS DISTINCT FROM OLD.shopify_connect_enabled
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.is_admin IS TRUE
     )
  THEN
    NEW.shopify_connect_enabled := OLD.shopify_connect_enabled;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_shopify_connect_privilege_trigger ON public.profiles;
CREATE TRIGGER profiles_guard_shopify_connect_privilege_trigger
  BEFORE UPDATE OF shopify_connect_enabled ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_shopify_connect_privilege();

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS inventory_source text NOT NULL DEFAULT 'reswell';

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_inventory_source_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_inventory_source_check
  CHECK (inventory_source IN ('reswell', 'shopify'));

CREATE INDEX IF NOT EXISTS listings_shopify_inventory_source_idx
  ON public.listings (user_id, status, updated_at DESC)
  WHERE inventory_source = 'shopify';

COMMENT ON COLUMN public.listings.inventory_source IS
  'reswell for normal listings; shopify when product fields and inventory are remotely managed.';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'refunding', 'refunded'));

CREATE TABLE IF NOT EXISTS public.shopify_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  shop_name text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'reauthorization_required', 'error')),
  sync_enabled boolean NOT NULL DEFAULT true,
  access_token_ciphertext text NOT NULL,
  access_token_iv text NOT NULL,
  access_token_tag text NOT NULL,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  encryption_key_version integer NOT NULL DEFAULT 1,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  token_refresh_locked_until timestamptz,
  token_refresh_lock_id text,
  scopes text[] NOT NULL DEFAULT '{}',
  last_webhook_at timestamptz,
  last_reconciled_at timestamptz,
  last_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopify_connections_user_unique UNIQUE (user_id),
  CONSTRAINT shopify_connections_shop_unique UNIQUE (shop_domain)
);

CREATE INDEX IF NOT EXISTS shopify_connections_reconcile_idx
  ON public.shopify_connections (status, sync_enabled, last_reconciled_at);

COMMENT ON TABLE public.shopify_connections IS
  'Encrypted, server-only Shopify installations for approved Reswell merchants.';

CREATE TABLE IF NOT EXISTS public.shopify_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopify_oauth_states_expiry_idx
  ON public.shopify_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS public.shopify_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  shopify_product_gid text NOT NULL,
  shopify_variant_gid text NOT NULL,
  shopify_inventory_item_gid text NOT NULL,
  reswell_section text NOT NULL
    CHECK (reswell_section IN (
      'surfboards', 'fins', 'wetsuits', 'boardbags', 'surfpacks',
      'leashes', 'apparel', 'accessories', 'magazines', 'traction'
    )),
  selected boolean NOT NULL DEFAULT true,
  inventory_generation bigint NOT NULL DEFAULT 0,
  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'out_of_stock', 'deleted', 'unselected', 'error')),
  remote_updated_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopify_product_mappings_listing_unique UNIQUE (listing_id),
  CONSTRAINT shopify_product_mappings_variant_unique
    UNIQUE (connection_id, shopify_variant_gid)
);

CREATE INDEX IF NOT EXISTS shopify_product_mappings_product_idx
  ON public.shopify_product_mappings (connection_id, shopify_product_gid);

CREATE INDEX IF NOT EXISTS shopify_product_mappings_inventory_item_idx
  ON public.shopify_product_mappings (connection_id, shopify_inventory_item_gid);

CREATE TABLE IF NOT EXISTS public.shopify_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.shopify_connections(id) ON DELETE SET NULL,
  shop_domain text NOT NULL,
  webhook_id text NOT NULL,
  topic text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry', 'processed', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  worker_id text,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopify_webhook_events_delivery_unique UNIQUE (shop_domain, webhook_id)
);

CREATE INDEX IF NOT EXISTS shopify_webhook_events_claim_idx
  ON public.shopify_webhook_events (status, available_at, created_at)
  WHERE status IN ('queued', 'retry', 'processing');

CREATE TABLE IF NOT EXISTS public.shopify_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  job_type text NOT NULL
    CHECK (job_type IN (
      'product_sync',
      'product_delete',
      'inventory_sync',
      'inventory_decrement',
      'reconcile_connection'
    )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry', 'succeeded', 'dead', 'canceled')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  worker_id text,
  dedupe_key text,
  idempotency_key text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopify_sync_jobs_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS shopify_sync_jobs_claim_idx
  ON public.shopify_sync_jobs (status, run_after, created_at)
  WHERE status IN ('queued', 'retry', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS shopify_sync_jobs_active_dedupe_idx
  ON public.shopify_sync_jobs (dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND status IN ('queued', 'retry');

CREATE TABLE IF NOT EXISTS public.shopify_inventory_compensations (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_intent_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'refunding', 'refunded', 'failed')),
  original_seller_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  original_platform_fee numeric(12, 2) NOT NULL DEFAULT 0,
  stripe_refund_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_inventory_compensations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.shopify_connections FROM anon, authenticated;
REVOKE ALL ON public.shopify_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.shopify_product_mappings FROM anon, authenticated;
REVOKE ALL ON public.shopify_webhook_events FROM anon, authenticated;
REVOKE ALL ON public.shopify_sync_jobs FROM anon, authenticated;
REVOKE ALL ON public.shopify_inventory_compensations FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_oauth_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_product_mappings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_webhook_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_sync_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_inventory_compensations TO service_role;

CREATE OR REPLACE FUNCTION public.claim_shopify_webhook_events(
  p_limit integer DEFAULT 20,
  p_worker text DEFAULT 'worker',
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.shopify_webhook_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM public.shopify_webhook_events
    WHERE (
      status IN ('queued', 'retry')
      AND available_at <= now()
    ) OR (
      status = 'processing'
      AND locked_until < now()
    )
    ORDER BY available_at ASC, created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.shopify_webhook_events e
  SET status = 'processing',
      attempts = e.attempts + 1,
      locked_until = now() + make_interval(secs => GREATEST(30, p_lease_seconds)),
      worker_id = p_worker,
      updated_at = now()
  FROM due
  WHERE e.id = due.id
  RETURNING e.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_shopify_sync_jobs(
  p_limit integer DEFAULT 20,
  p_worker text DEFAULT 'worker',
  p_lease_seconds integer DEFAULT 180
)
RETURNS SETOF public.shopify_sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      j.id,
      row_number() OVER (
        PARTITION BY CASE
          WHEN j.job_type = 'inventory_decrement'
            THEN 'inventory:' || coalesce(j.payload ->> 'mappingId', j.id::text)
          ELSE j.id::text
        END
        ORDER BY j.run_after ASC, j.created_at ASC
      ) AS queue_rank
    FROM public.shopify_sync_jobs j
    WHERE (
      j.status IN ('queued', 'retry')
      AND j.run_after <= now()
      AND (
        j.job_type <> 'inventory_decrement'
        OR NOT EXISTS (
          SELECT 1
          FROM public.shopify_sync_jobs active
          WHERE active.id <> j.id
            AND active.job_type = 'inventory_decrement'
            AND active.status = 'processing'
            AND active.locked_until >= now()
            AND active.payload ->> 'mappingId' = j.payload ->> 'mappingId'
        )
      )
    ) OR (
      j.status = 'processing'
      AND j.locked_until < now()
    )
  ),
  due AS (
    SELECT j.id
    FROM public.shopify_sync_jobs j
    JOIN ranked r ON r.id = j.id
    WHERE r.queue_rank = 1
    ORDER BY j.run_after ASC, j.created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.shopify_sync_jobs j
  SET status = 'processing',
      attempts = j.attempts + 1,
      locked_until = now() + make_interval(secs => GREATEST(30, p_lease_seconds)),
      worker_id = p_worker,
      updated_at = now()
  FROM due
  WHERE j.id = due.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_shopify_webhook_events(integer, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_shopify_sync_jobs(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_shopify_webhook_events(integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_shopify_sync_jobs(integer, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.begin_shopify_inventory_compensation(
  p_order_id uuid,
  p_payment_intent_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_has_pending_earnings boolean;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  INSERT INTO public.shopify_inventory_compensations (
    order_id,
    payment_intent_id,
    status,
    original_seller_earnings,
    original_platform_fee
  )
  VALUES (
    p_order_id,
    p_payment_intent_id,
    'pending',
    v_order.seller_earnings,
    v_order.platform_fee
  )
  ON CONFLICT (order_id) DO NOTHING;

  SELECT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'order_pending_earnings'
      AND wt.reference_id::text = p_order_id::text
  )
  INTO v_has_pending_earnings;

  UPDATE public.orders
  SET status = 'refunding',
      seller_earnings = CASE
        WHEN v_has_pending_earnings THEN seller_earnings
        ELSE 0
      END,
      platform_fee = CASE
        WHEN v_has_pending_earnings THEN platform_fee
        ELSE 0
      END,
      updated_at = now()
  WHERE id = p_order_id
    AND status IN ('confirmed', 'refunding');

  UPDATE public.payouts
  SET status = 'cancelled',
      amount = 0,
      updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('held', 'pending', 'processing');
END;
$$;

REVOKE ALL ON FUNCTION public.begin_shopify_inventory_compensation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_shopify_inventory_compensation(uuid, text) TO service_role;

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
  SELECT inventory_source
  INTO v_inventory_source
  FROM public.listings
  WHERE id = p_listing_id;

  IF v_inventory_source IS DISTINCT FROM 'shopify' THEN
    RETURN false;
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required for Shopify inventory sales';
  END IF;

  SELECT m.*
  INTO v_mapping
  FROM public.shopify_product_mappings m
  JOIN public.shopify_connections c ON c.id = m.connection_id
  JOIN public.listings l ON l.id = m.listing_id
  WHERE m.listing_id = p_listing_id
    AND m.selected IS TRUE
    AND c.status = 'active'
    AND c.sync_enabled IS TRUE
    AND l.inventory_source = 'shopify'
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shopify-managed listing % has no active mapping', p_listing_id;
  END IF;

  INSERT INTO public.shopify_sync_jobs (
    connection_id,
    job_type,
    payload,
    idempotency_key
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

  IF v_job_id IS NULL THEN
    RETURN false;
  END IF;

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

REVOKE ALL ON FUNCTION public.record_shopify_listing_sale(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_shopify_listing_sale(uuid, uuid, integer) TO service_role;

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
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  FOR v_mapping IN
    SELECT *
    FROM public.shopify_product_mappings
    WHERE id = ANY(p_mapping_ids)
    FOR UPDATE
  LOOP
    IF v_mapping.inventory_generation <> p_expected_generation THEN
      listing_id := v_mapping.listing_id;
      SELECT stock_quantity INTO projected_stock
      FROM public.listings
      WHERE id = v_mapping.listing_id;
      RETURN NEXT;
      CONTINUE;
    END IF;

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
        status = CASE WHEN v_projected > 0 THEN 'active' ELSE 'removed' END,
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

REVOKE ALL ON FUNCTION public.apply_shopify_inventory_projection(uuid[], integer, bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_shopify_inventory_projection(uuid[], integer, bigint, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.order_items_record_shopify_listing_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_status = 'confirmed' THEN
    PERFORM public.record_shopify_listing_sale(
      NEW.order_id,
      NEW.listing_id,
      GREATEST(1, coalesce(NEW.quantity, 1))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_record_shopify_listing_sale_trigger ON public.order_items;
CREATE TRIGGER order_items_record_shopify_listing_sale_trigger
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.order_items_record_shopify_listing_sale();

CREATE OR REPLACE FUNCTION public.guard_shopify_managed_listing_truth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF NEW.inventory_source IS DISTINCT FROM OLD.inventory_source THEN
      NEW.inventory_source := OLD.inventory_source;
    END IF;
  END IF;
  IF OLD.inventory_source = 'shopify'
     AND coalesce(auth.role(), '') <> 'service_role'
  THEN
    NEW.title := OLD.title;
    NEW.description := OLD.description;
    NEW.price := OLD.price;
    NEW.compare_at_price := OLD.compare_at_price;
    NEW.condition := OLD.condition;
    NEW.section := OLD.section;
    NEW.category_id := OLD.category_id;
    NEW.brand := OLD.brand;
    NEW.model := OLD.model;
    NEW.stock_quantity := OLD.stock_quantity;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_shopify_managed_listing_truth_trigger ON public.listings;
CREATE TRIGGER guard_shopify_managed_listing_truth_trigger
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_shopify_managed_listing_truth();

CREATE OR REPLACE FUNCTION public.guard_shopify_managed_listing_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.inventory_source = 'shopify'
     AND coalesce(auth.role(), '') <> 'service_role'
  THEN
    NEW.inventory_source := 'reswell';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_shopify_managed_listing_insert_trigger ON public.listings;
CREATE TRIGGER guard_shopify_managed_listing_insert_trigger
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_shopify_managed_listing_insert();

CREATE OR REPLACE FUNCTION public.guard_shopify_managed_listing_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.inventory_source = 'shopify'
     AND coalesce(auth.role(), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Shopify-managed listings must be removed from the integration dashboard';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_shopify_managed_listing_delete_trigger ON public.listings;
CREATE TRIGGER guard_shopify_managed_listing_delete_trigger
  BEFORE DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_shopify_managed_listing_delete();

CREATE OR REPLACE FUNCTION public.guard_shopify_managed_listing_images()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
BEGIN
  v_listing_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.listing_id ELSE NEW.listing_id END;
  IF coalesce(auth.role(), '') <> 'service_role'
     AND EXISTS (
       SELECT 1
       FROM public.listings l
       WHERE l.id = v_listing_id
         AND l.inventory_source = 'shopify'
     )
  THEN
    RAISE EXCEPTION 'Shopify-managed listing images are read-only';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS guard_shopify_managed_listing_images_trigger ON public.listing_images;
CREATE TRIGGER guard_shopify_managed_listing_images_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.listing_images
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_shopify_managed_listing_images();

COMMIT;
