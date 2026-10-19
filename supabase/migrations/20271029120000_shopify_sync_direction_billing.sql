-- Source of truth, Shopify usage billing, and one paid order per Reswell sale.
-- Existing connections stay Shopify-sourced. Sync stays off until the merchant
-- approves the usage charge. A sale no longer queues a second inventory adjustment.

BEGIN;

ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS source_of_truth text NOT NULL DEFAULT 'shopify';

ALTER TABLE public.shopify_connections
  DROP CONSTRAINT IF EXISTS shopify_connections_source_of_truth_check;

ALTER TABLE public.shopify_connections
  ADD CONSTRAINT shopify_connections_source_of_truth_check
  CHECK (source_of_truth IN ('shopify', 'reswell'));

ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.shopify_connections
  DROP CONSTRAINT IF EXISTS shopify_connections_billing_status_check;

ALTER TABLE public.shopify_connections
  ADD CONSTRAINT shopify_connections_billing_status_check
  CHECK (billing_status IN ('pending', 'active', 'declined'));

ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS billing_subscription_gid text,
  ADD COLUMN IF NOT EXISTS billing_line_item_gid text,
  ADD COLUMN IF NOT EXISTS billing_capped_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS billing_approved_at timestamptz;

COMMENT ON COLUMN public.shopify_connections.source_of_truth IS
  'shopify: Shopify product fields and stock win. reswell: chosen Reswell listings publish to Shopify and Shopify edits do not rewrite them.';

COMMENT ON COLUMN public.shopify_connections.billing_status IS
  'Shopify usage-charge approval. Catalog sync stays off until active. pending and declined do not bill through Shopify.';

UPDATE public.shopify_connections
SET sync_enabled = false
WHERE billing_status IS DISTINCT FROM 'active';

CREATE TABLE IF NOT EXISTS public.shopify_sale_records (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  source_of_truth text NOT NULL
    CHECK (source_of_truth IN ('shopify', 'reswell')),
  collect_via text NOT NULL
    CHECK (collect_via IN ('shopify', 'stripe')),
  item_price numeric(12, 2) NOT NULL DEFAULT 0,
  usage_amount numeric(12, 2) NOT NULL DEFAULT 0,
  shopify_order_gid text,
  usage_record_gid text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ordered', 'adjusted', 'charged', 'skipped')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shopify_sale_records_order_gid_uidx
  ON public.shopify_sale_records (shopify_order_gid)
  WHERE shopify_order_gid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shopify_sale_records_usage_gid_uidx
  ON public.shopify_sale_records (usage_record_gid)
  WHERE usage_record_gid IS NOT NULL;

ALTER TABLE public.shopify_sale_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopify_sale_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_sale_records TO service_role;

COMMENT ON TABLE public.shopify_sale_records IS
  'One Reswell order creates at most one paid Shopify order and at most one 7% usage record.';

ALTER TABLE public.shopify_sync_jobs
  DROP CONSTRAINT IF EXISTS shopify_sync_jobs_job_type_check;

ALTER TABLE public.shopify_sync_jobs
  ADD CONSTRAINT shopify_sync_jobs_job_type_check
  CHECK (job_type IN (
    'product_sync',
    'product_delete',
    'inventory_sync',
    'inventory_decrement',
    'reconcile_connection',
    'sale_order'
  ));

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
  v_billing text;
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

  SELECT m, c.source_of_truth, c.billing_status
  INTO v_mapping, v_source, v_billing
  FROM public.shopify_product_mappings m
  JOIN public.shopify_connections c ON c.id = m.connection_id
  JOIN public.listings l ON l.id = m.listing_id
  WHERE m.listing_id = p_listing_id
    AND m.selected IS TRUE
    AND c.status = 'active'
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    IF v_inventory_source = 'shopify' THEN
      RAISE EXCEPTION 'Shopify-managed listing % has no active mapping', p_listing_id;
    END IF;
    RETURN false;
  END IF;

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
      'collectVia', CASE WHEN v_billing = 'active' THEN 'shopify' ELSE 'stripe' END,
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

COMMIT;
