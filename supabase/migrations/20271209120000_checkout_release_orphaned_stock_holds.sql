-- Unique checkout holds from expired/canceled sessions were still blocking
-- a new PaymentIntent with "This item is no longer available". Release any
-- hold whose session is not open, and ignore those rows when reserving.

CREATE OR REPLACE FUNCTION public.expire_stale_checkout_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.checkout_stock_holds h
  SET status = 'released'
  WHERE h.status = 'held'
    AND (
      h.expires_at < now()
      OR NOT EXISTS (
        SELECT 1
        FROM public.checkout_sessions s
        WHERE s.id = h.session_id
          AND s.status = 'open'
      )
    );

  UPDATE public.checkout_sessions
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'open'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.checkout_stock_holds h
  SET status = 'released'
  WHERE h.status = 'held'
    AND NOT EXISTS (
      SELECT 1
      FROM public.checkout_sessions s
      WHERE s.id = h.session_id
        AND s.status = 'open'
    );

  DELETE FROM public.checkout_stock_holds
  WHERE status IN ('captured', 'released')
    AND created_at < now() - interval '14 days';

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_checkout_sessions() IS
  'Expires open sessions past TTL, releases holds for non-open sessions, and deletes terminal stock holds older than 14 days.';

CREATE OR REPLACE FUNCTION public.reserve_checkout_session_stock(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE;
  v_item public.checkout_session_items%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_held integer;
  v_available integer;
  v_stock_backed boolean;
BEGIN
  SELECT * INTO v_session
  FROM public.checkout_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserve_checkout_session_stock: session % not found', p_session_id;
  END IF;

  PERFORM public.release_checkout_session_stock(p_session_id);

  -- Unique index is on every held unique row, including holds whose session
  -- was expired without a matching release. Clear those before we re-hold.
  UPDATE public.checkout_stock_holds h
  SET status = 'released'
  WHERE h.status = 'held'
    AND NOT EXISTS (
      SELECT 1
      FROM public.checkout_sessions s
      WHERE s.id = h.session_id
        AND s.status = 'open'
        AND s.expires_at > now()
    );

  FOR v_item IN
    SELECT * FROM public.checkout_session_items WHERE session_id = p_session_id
  LOOP
    SELECT * INTO v_listing
    FROM public.listings
    WHERE id = v_item.listing_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'reserve_checkout_session_stock: listing % not found', v_item.listing_id;
    END IF;

    v_stock_backed := NOT v_item.unique_item;

    IF v_item.unique_item THEN
      IF EXISTS (
        SELECT 1
        FROM public.checkout_stock_holds h
        JOIN public.checkout_sessions s ON s.id = h.session_id
        WHERE h.listing_id = v_item.listing_id
          AND h.status = 'held'
          AND h.unique_item = true
          AND h.expires_at > now()
          AND s.status = 'open'
          AND s.expires_at > now()
      ) THEN
        RAISE EXCEPTION 'reserve_checkout_session_stock: listing % already reserved', v_item.listing_id
          USING ERRCODE = 'unique_violation';
      END IF;
      IF v_listing.status IS DISTINCT FROM 'active' AND v_listing.status IS DISTINCT FROM 'pending_sale' THEN
        RAISE EXCEPTION 'reserve_checkout_session_stock: listing % is not available', v_item.listing_id
          USING ERRCODE = 'unique_violation';
      END IF;
    ELSE
      SELECT COALESCE(SUM(h.quantity), 0) INTO v_held
      FROM public.checkout_stock_holds h
      JOIN public.checkout_sessions s ON s.id = h.session_id
      WHERE h.listing_id = v_item.listing_id
        AND h.status = 'held'
        AND h.expires_at > now()
        AND s.status = 'open'
        AND s.expires_at > now();

      v_available := GREATEST(0, COALESCE(v_listing.stock_quantity, 0) - v_held);
      IF v_available < v_item.quantity THEN
        RAISE EXCEPTION 'reserve_checkout_session_stock: insufficient stock for listing %', v_item.listing_id
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    INSERT INTO public.checkout_stock_holds (
      session_id,
      listing_id,
      quantity,
      unique_item,
      status,
      expires_at
    ) VALUES (
      p_session_id,
      v_item.listing_id,
      v_item.quantity,
      v_item.unique_item,
      'held',
      v_session.expires_at
    );
  END LOOP;
END;
$$;
