-- Multi-quantity inventory: atomic decrement on purchase for sync_managed listings.

BEGIN;

CREATE OR REPLACE FUNCTION public.decrement_listing_stock_after_purchase(
  p_listing_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.listings%ROWTYPE;
  v_new_qty integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity');
  END IF;

  SELECT * INTO v_row FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  -- Shopify / sync-managed catalog: decrement stock; P2P unique items: mark sold.
  IF v_row.sync_managed = true THEN
    IF COALESCE(v_row.stock_quantity, 0) < p_quantity THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_stock');
    END IF;

    v_new_qty := v_row.stock_quantity - p_quantity;

    IF v_new_qty <= 0 THEN
      UPDATE public.listings
      SET
        stock_quantity = 0,
        status = 'removed',
        updated_at = NOW()
      WHERE id = p_listing_id;

      RETURN jsonb_build_object(
        'ok', true,
        'action', 'depleted',
        'stock_quantity', 0,
        'status', 'removed'
      );
    END IF;

    UPDATE public.listings
    SET
      stock_quantity = v_new_qty,
      updated_at = NOW()
    WHERE id = p_listing_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'decremented',
      'stock_quantity', v_new_qty,
      'status', v_row.status
    );
  END IF;

  UPDATE public.listings
  SET status = 'sold', updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true, 'action', 'sold', 'status', 'sold');
END;
$$;

COMMENT ON FUNCTION public.decrement_listing_stock_after_purchase IS
  'After checkout: decrement stock_quantity for sync_managed listings or mark unique P2P listings sold.';

COMMIT;
