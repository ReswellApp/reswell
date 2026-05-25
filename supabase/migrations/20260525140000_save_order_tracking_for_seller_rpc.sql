-- Seller saves carrier tracking while delivery_status stays pending (confirm-shipment is separate).

CREATE OR REPLACE FUNCTION public.save_order_tracking_for_seller(
  p_order_id uuid,
  p_tracking_number text,
  p_tracking_carrier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid := auth.uid();
  r record;
  v_track text := nullif(trim(p_tracking_number), '');
  v_carrier text := nullif(trim(coalesce(p_tracking_carrier, '')), '');
BEGIN
  IF v_seller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF v_track IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tracking_required');
  END IF;

  SELECT id, fulfillment_method, delivery_status
  INTO r
  FROM public.orders
  WHERE id = p_order_id
    AND seller_id = v_seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.fulfillment_method IS DISTINCT FROM 'shipping' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_shipping');
  END IF;

  IF r.delivery_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  UPDATE public.orders
  SET
    tracking_number = v_track,
    tracking_carrier = v_carrier,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'tracking_number', v_track,
    'tracking_carrier', v_carrier
  );
END;
$$;

COMMENT ON FUNCTION public.save_order_tracking_for_seller(uuid, text, text) IS
  'Seller saves tracking_number/carrier on a pending shipping order without marking shipped.';

REVOKE ALL ON FUNCTION public.save_order_tracking_for_seller(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_order_tracking_for_seller(uuid, text, text) TO authenticated;
