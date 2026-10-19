-- Brand-new peer listings can carry stock_quantity. Decrement those units the
-- same way Reswell shop inventory decrements, and mark the listing sold only
-- when the last unit sells. Used peer listings stay single-quantity.

CREATE OR REPLACE FUNCTION public.decrement_listing_stock(
  p_listing_id uuid,
  p_qty integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'decrement_listing_stock: qty must be >= 1';
  END IF;

  UPDATE public.listings
  SET
    stock_quantity = stock_quantity - p_qty,
    status = CASE
      WHEN stock_quantity - p_qty <= 0 THEN 'sold'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_listing_id
    AND stock_quantity >= p_qty
    AND coalesce(inventory_source, 'reswell') IS DISTINCT FROM 'shopify'
    AND (
      section = 'new'
      OR condition IN ('brand_new', 'new')
    )
  RETURNING stock_quantity INTO v_remaining;

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'decrement_listing_stock: insufficient stock for listing %', p_listing_id;
  END IF;

  RETURN v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_listing_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_listing_stock(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.decrement_listing_stock(uuid, integer) IS
  'Atomically decrements Reswell shop stock or brand-new peer stock. Marks sold when remaining hits 0. Service role only.';
