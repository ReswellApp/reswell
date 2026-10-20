-- Shopify-managed listings stay off sale until the usage charge is active.
-- Pending, declined, and any other non-active billing state use the existing
-- sales_enabled gate: inventory projection marks them removed, and a sale cannot
-- record a Stripe marketplace fee for that listing.

BEGIN;

ALTER TABLE public.shopify_connections
  ALTER COLUMN sales_enabled SET DEFAULT false;

COMMENT ON COLUMN public.shopify_connections.sales_enabled IS
  'True only while billing_status is active. Inventory projection will not mark a Shopify listing active while this is false.';

UPDATE public.shopify_connections
SET sales_enabled = (billing_status = 'active');

UPDATE public.listings AS listings
SET status = 'removed',
    updated_at = now()
FROM public.shopify_product_mappings AS mappings
JOIN public.shopify_connections AS connections
  ON connections.id = mappings.connection_id
WHERE listings.id = mappings.listing_id
  AND listings.inventory_source = 'shopify'
  AND listings.status IN ('active', 'pending_sale')
  AND connections.billing_status IS DISTINCT FROM 'active';

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
  v_source text;
  v_job_id uuid;
  v_quantity integer := GREATEST(1, coalesce(p_quantity, 1));
  v_inventory_source text;
BEGIN
  SELECT inventory_source
  INTO v_inventory_source
  FROM public.listings
  WHERE id = p_listing_id;

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
    AND c.billing_status = 'active'
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    IF v_inventory_source = 'shopify' THEN
      RAISE EXCEPTION 'Shopify-managed listing % is not for sale until the usage charge is approved', p_listing_id;
    END IF;
    RETURN false;
  END IF;

  SELECT c.source_of_truth
  INTO v_source
  FROM public.shopify_connections c
  WHERE c.id = v_mapping.connection_id;

  INSERT INTO public.shopify_sync_jobs (
    connection_id,
    job_type,
    payload,
    idempotency_key
  )
  VALUES (
    v_mapping.connection_id,
    'sale_order',
    jsonb_build_object(
      'mappingId', v_mapping.id,
      'listingId', p_listing_id,
      'orderId', p_order_id,
      'quantity', v_quantity,
      'collectVia', 'shopify',
      'sourceOfTruth', v_source
    ),
    format('sale:%s:%s', p_order_id, p_listing_id)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_inventory_source = 'shopify' THEN
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
  END IF;

  RETURN true;
END;
$$;

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
  v_billing text;
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

    SELECT c.sales_enabled, c.billing_status
    INTO v_sales_enabled, v_billing
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
          WHEN v_projected > 0
            AND coalesce(v_sales_enabled, false)
            AND v_billing = 'active'
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

COMMIT;
