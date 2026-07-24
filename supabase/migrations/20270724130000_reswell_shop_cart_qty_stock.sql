-- Reswell shop inventory: cart/order quantities + atomic stock decrement.

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_quantity_check;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_quantity_check CHECK (quantity >= 1);

COMMENT ON COLUMN public.cart_items.quantity IS
  'Units in cart. Peer listings stay at 1; Reswell shop (section=new) may be 1..stock_quantity.';

DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
CREATE POLICY "cart_items_update_own" ON public.cart_items
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_quantity_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_check CHECK (quantity >= 1);

COMMENT ON COLUMN public.order_items.quantity IS
  'Units purchased for this line. item_price is the unit price; line total = item_price * quantity.';

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
    AND section = 'new'
    AND stock_quantity >= p_qty
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
  'Atomically decrements Reswell shop stock; marks sold when remaining hits 0. Service role only.';
