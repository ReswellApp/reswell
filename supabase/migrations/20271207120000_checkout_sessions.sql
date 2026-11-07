-- Durable marketplace checkout sessions.
-- One open session per buyer + cart fingerprint. One Stripe PaymentIntent per session.
-- Stock holds make quantity listings (shop / brand-new) unavailable to a second
-- overlapping checkout until this session pays, expires, or is released.
-- Apply in production before relying on this path; create-payment-intent fail-opens
-- to hashed PaymentIntent idempotency if these tables are missing.

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users (id),
  fingerprint text NOT NULL,
  listing_ids uuid[] NOT NULL,
  listing_qtys jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  fulfillment text NOT NULL,
  address_id uuid,
  promo_code_id uuid,
  stripe_payment_intent_id text,
  order_id uuid REFERENCES public.orders (id),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paid', 'canceled', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checkout_sessions IS
  'One checkout attempt. Retries resume this row instead of creating another PaymentIntent.';

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_open_fingerprint_uidx
  ON public.checkout_sessions (buyer_id, fingerprint)
  WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_payment_intent_uidx
  ON public.checkout_sessions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL
    AND trim(stripe_payment_intent_id) <> '';

CREATE INDEX IF NOT EXISTS checkout_sessions_buyer_created_idx
  ON public.checkout_sessions (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS checkout_sessions_open_expires_idx
  ON public.checkout_sessions (expires_at)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.checkout_session_items (
  session_id uuid NOT NULL REFERENCES public.checkout_sessions (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id),
  quantity integer NOT NULL CHECK (quantity >= 1),
  unique_item boolean NOT NULL DEFAULT false,
  PRIMARY KEY (session_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.checkout_stock_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.checkout_sessions (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id),
  quantity integer NOT NULL CHECK (quantity >= 1),
  unique_item boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'captured', 'released')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checkout_stock_holds IS
  'Inventory reserved for an open checkout. Captured on paid order, released on expire/cancel.';

CREATE UNIQUE INDEX IF NOT EXISTS checkout_stock_holds_unique_item_uidx
  ON public.checkout_stock_holds (listing_id)
  WHERE status = 'held' AND unique_item = true;

CREATE INDEX IF NOT EXISTS checkout_stock_holds_listing_held_idx
  ON public.checkout_stock_holds (listing_id)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS checkout_stock_holds_session_idx
  ON public.checkout_stock_holds (session_id);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_stock_holds ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.checkout_sessions TO service_role;
GRANT ALL ON TABLE public.checkout_session_items TO service_role;
GRANT ALL ON TABLE public.checkout_stock_holds TO service_role;
-- No authenticated/anon policies: buyers never read these tables from the browser.

CREATE OR REPLACE FUNCTION public.expire_stale_checkout_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.checkout_stock_holds
  SET status = 'released'
  WHERE status = 'held'
    AND expires_at < now();

  UPDATE public.checkout_sessions
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'open'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_checkout_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_checkout_sessions() TO service_role;

CREATE OR REPLACE FUNCTION public.release_checkout_session_stock(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checkout_stock_holds
  SET status = 'released'
  WHERE session_id = p_session_id
    AND status = 'held';
END;
$$;

REVOKE ALL ON FUNCTION public.release_checkout_session_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_checkout_session_stock(uuid) TO service_role;

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
        WHERE h.listing_id = v_item.listing_id
          AND h.status = 'held'
          AND h.unique_item = true
          AND h.expires_at > now()
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
      WHERE h.listing_id = v_item.listing_id
        AND h.status = 'held'
        AND h.expires_at > now();

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

REVOKE ALL ON FUNCTION public.reserve_checkout_session_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_checkout_session_stock(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.capture_checkout_session_stock(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Holds only reserve availability. Paid orders still decrement via
  -- completeMarketplaceOrder / decrement_listing_stock so we never double-count.
  UPDATE public.checkout_stock_holds
  SET status = 'captured'
  WHERE session_id = p_session_id
    AND status = 'held';
END;
$$;

REVOKE ALL ON FUNCTION public.capture_checkout_session_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_checkout_session_stock(uuid) TO service_role;
