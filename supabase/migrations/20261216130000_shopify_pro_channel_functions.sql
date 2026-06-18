-- RPCs for the Shopify pro channel: durable job claiming + row-locked variant inventory
-- reservation so the same SKU can't oversell across Shopify and Reswell checkout.

BEGIN;

-- ── Atomically claim due sync jobs (SKIP LOCKED = safe concurrent workers) ────
CREATE OR REPLACE FUNCTION public.claim_shopify_sync_jobs(
  p_limit integer DEFAULT 10,
  p_worker text DEFAULT 'worker'
)
RETURNS SETOF public.shopify_sync_jobs
LANGUAGE sql
AS $$
  WITH due AS (
    SELECT id
    FROM public.shopify_sync_jobs
    WHERE status IN ('queued', 'failed')
      AND run_after <= now()
      AND attempts < max_attempts
    ORDER BY run_after ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.shopify_sync_jobs j
  SET status = 'running',
      locked_at = now(),
      locked_by = p_worker,
      attempts = j.attempts + 1,
      updated_at = now()
  FROM due
  WHERE j.id = due.id
  RETURNING j.*;
$$;

-- ── Reserve stock for a variant at checkout start (row lock) ───────────────────
CREATE OR REPLACE FUNCTION public.reserve_listing_variant_stock(
  p_variant_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock integer;
  v_reserved integer;
  v_available integer;
BEGIN
  SELECT stock_quantity, reserved_quantity
    INTO v_stock, v_reserved
  FROM public.listing_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'variant_not_found');
  END IF;

  v_available := v_stock - v_reserved;
  IF v_available < p_quantity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_stock', 'available', v_available);
  END IF;

  UPDATE public.listing_variants
  SET reserved_quantity = reserved_quantity + p_quantity,
      updated_at = now()
  WHERE id = p_variant_id;

  RETURN jsonb_build_object('ok', true, 'reserved', p_quantity, 'available', v_available - p_quantity);
END;
$$;

-- ── Release a prior reservation (checkout abandoned / payment failed) ──────────
CREATE OR REPLACE FUNCTION public.release_listing_variant_stock(
  p_variant_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.listing_variants
  SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
      updated_at = now()
  WHERE id = p_variant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'variant_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Commit a reservation on successful payment: decrement real stock ──────────
CREATE OR REPLACE FUNCTION public.commit_listing_variant_stock(
  p_variant_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock integer;
  v_reserved integer;
  v_new_stock integer;
BEGIN
  SELECT stock_quantity, reserved_quantity
    INTO v_stock, v_reserved
  FROM public.listing_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'variant_not_found');
  END IF;

  v_new_stock := GREATEST(0, v_stock - p_quantity);

  UPDATE public.listing_variants
  SET stock_quantity = v_new_stock,
      reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
      in_stock = (v_new_stock > 0),
      updated_at = now()
  WHERE id = p_variant_id;

  RETURN jsonb_build_object('ok', true, 'stock_quantity', v_new_stock);
END;
$$;

COMMIT;
