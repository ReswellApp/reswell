-- Local pickup verification now stamps orders.carrier_delivered_at so purchase and
-- sale details can show the pickup date and time. Shipping orders are unchanged.

COMMENT ON COLUMN public.orders.carrier_delivered_at IS
  'First timestamp when fulfillment completed: ShipEngine delivery for shipping, or seller pickup verification for local pickup. Shipping payout auto-release runs after this.';

CREATE OR REPLACE FUNCTION public.verify_order_pickup_for_seller(
  p_order_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid := auth.uid();
  r record;
BEGIN
  IF v_seller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_required');
  END IF;

  SELECT
    id,
    seller_id,
    buyer_id,
    listing_id,
    fulfillment_method,
    delivery_status,
    pickup_code,
    is_admin_test
  INTO r
  FROM public.orders
  WHERE id = p_order_id
    AND seller_id = v_seller_id
    AND is_admin_test = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.fulfillment_method IS DISTINCT FROM 'pickup' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pickup');
  END IF;

  IF r.delivery_status = 'picked_up' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_picked_up');
  END IF;

  IF trim(coalesce(r.pickup_code::text, '')) IS DISTINCT FROM trim(p_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.orders
  SET
    delivery_status = 'picked_up',
    carrier_delivered_at = COALESCE(carrier_delivered_at, now()),
    updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.payouts
  SET
    status = 'pending',
    hold_reason = NULL,
    released_at = now(),
    updated_at = now()
  WHERE order_id = p_order_id
    AND seller_id = v_seller_id
    AND status = 'held';

  RETURN jsonb_build_object(
    'ok', true,
    'buyer_id', r.buyer_id,
    'listing_id', r.listing_id
  );
END;
$$;

COMMENT ON FUNCTION public.verify_order_pickup_for_seller(uuid, text) IS
  'Seller confirms local pickup with buyer code; sets delivery_status, stamps carrier_delivered_at, and releases payout row. Uses session user as seller.';

-- Historical pickup orders: prefer payout release time, then updated_at.
UPDATE public.orders o
SET carrier_delivered_at = COALESCE(p.released_at, o.updated_at)
FROM public.payouts p
WHERE p.order_id = o.id
  AND o.fulfillment_method = 'pickup'
  AND o.delivery_status = 'picked_up'
  AND o.carrier_delivered_at IS NULL;

UPDATE public.orders
SET carrier_delivered_at = updated_at
WHERE fulfillment_method = 'pickup'
  AND delivery_status = 'picked_up'
  AND carrier_delivered_at IS NULL;
