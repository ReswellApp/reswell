-- Admin test purchases must not appear as real seller sales or affect earnings aggregates.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_admin_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.is_admin_test IS
  'True for admin-seeded test checkout rows (no seller sales UI, earnings, or payouts).';

UPDATE public.orders
SET is_admin_test = true
WHERE stripe_checkout_session_id LIKE 'admin_test_%'
  AND is_admin_test = false;

-- Test orders should never have held payout obligations.
DELETE FROM public.payouts p
USING public.orders o
WHERE p.order_id = o.id
  AND o.is_admin_test = true;

CREATE OR REPLACE FUNCTION public.orders_create_pending_payout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin_test IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.payouts (order_id, seller_id, amount, status, hold_reason)
  VALUES (
    NEW.id,
    NEW.seller_id,
    NEW.seller_earnings,
    'held',
    CASE
      WHEN NEW.fulfillment_method = 'shipping' THEN 'awaiting_shipment'
      WHEN NEW.fulfillment_method = 'pickup' THEN 'awaiting_pickup'
      ELSE 'awaiting_shipment'
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_seller_earnings_totals()
RETURNS TABLE (
  lifetime_sold_usd numeric,
  earned_last_30d_usd numeric,
  earned_last_90d_usd numeric,
  earned_last_365d_usd numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.is_admin_test = false
            AND o.status IS DISTINCT FROM 'refunded'
        ),
        2
      ),
      0
    )::numeric AS lifetime_sold_usd,
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.is_admin_test = false
            AND o.status IS DISTINCT FROM 'refunded'
            AND o.created_at >= now() - interval '30 days'
        ),
        2
      ),
      0
    )::numeric AS earned_last_30d_usd,
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.is_admin_test = false
            AND o.status IS DISTINCT FROM 'refunded'
            AND o.created_at >= now() - interval '90 days'
        ),
        2
      ),
      0
    )::numeric AS earned_last_90d_usd,
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.is_admin_test = false
            AND o.status IS DISTINCT FROM 'refunded'
            AND o.created_at >= now() - interval '365 days'
        ),
        2
      ),
      0
    )::numeric AS earned_last_365d_usd;
$$;

COMMENT ON FUNCTION public.get_my_seller_earnings_totals() IS
  'Dashboard: sums orders.seller_earnings for the current user (excludes admin test orders and status=refunded).';

CREATE OR REPLACE FUNCTION public.recently_sold_surfboard_listing_sale_times(p_limit integer)
RETURNS TABLE(listing_id uuid, sale_confirmed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH sale_lines AS (
    SELECT oi.listing_id AS lid, o.created_at AS sale_at
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false

    UNION ALL

    SELECT o.listing_id, o.created_at
    FROM public.orders o
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  ),
  per_listing AS (
    SELECT sl.lid, MAX(sl.sale_at)::timestamptz AS sale_confirmed_at
    FROM sale_lines sl
    GROUP BY sl.lid
  )
  SELECT pl.lid AS listing_id, pl.sale_confirmed_at
  FROM per_listing pl
  INNER JOIN public.listings l ON l.id = pl.lid
  WHERE l.section = 'surfboards'
    AND l.status = 'sold'
    AND l.hidden_from_site = false
    AND l.archived_at IS NULL
  ORDER BY pl.sale_confirmed_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 120);
$function$;

CREATE OR REPLACE FUNCTION public.marketplace_surfboard_confirmed_sale_stats()
RETURNS TABLE(items_sold bigint, gmv_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH sale_lines AS (
    SELECT oi.listing_id AS lid, oi.item_price AS line_item_price, o.amount AS order_amount
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false

    UNION ALL

    SELECT o.listing_id, NULL::numeric, o.amount
    FROM public.orders o
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  ),
  qualifying AS (
    SELECT COALESCE(sl.line_item_price, sl.order_amount)::numeric AS rev
    FROM sale_lines sl
    INNER JOIN public.listings l ON l.id = sl.lid
    WHERE l.section = 'surfboards'
      AND l.status = 'sold'
      AND l.hidden_from_site = false
      AND l.archived_at IS NULL
  )
  SELECT
    COUNT(*)::bigint AS items_sold,
    COALESCE(SUM(q.rev), 0)::numeric AS gmv_total
  FROM qualifying q;
$function$;

DROP POLICY IF EXISTS "orders_select_as_seller" ON public.orders;
CREATE POLICY "orders_select_as_seller"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = seller_id AND is_admin_test = false);

DROP POLICY IF EXISTS "payouts_select_as_order_party" ON public.payouts;
CREATE POLICY "payouts_select_as_order_party"
  ON public.payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.buyer_id = auth.uid()
          OR (o.seller_id = auth.uid() AND o.is_admin_test = false)
        )
    )
  );

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

CREATE OR REPLACE FUNCTION public.release_order_seller_earnings_to_wallet(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_order public.orders%ROWTYPE;
  r_payout public.payouts%ROWTYPE;
  r_wallet public.wallets%ROWTYPE;
  v_listing_title text;
  v_desc text;
  v_earn numeric(12, 2);
  v_new_bal numeric(12, 2);
  v_new_pending numeric(12, 2);
  v_pm_suffix text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'order_seller_earnings'
      AND wt.reference_id = p_order_id::text
  ) THEN
    RETURN false;
  END IF;

  SELECT *
  INTO r_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF r_order.is_admin_test IS TRUE THEN
    RETURN false;
  END IF;

  IF r_order.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'order_not_active';
  END IF;

  IF r_order.delivery_status NOT IN ('delivered', 'picked_up') THEN
    RAISE EXCEPTION 'fulfillment_incomplete';
  END IF;

  IF r_order.fulfillment_method IS NOT DISTINCT FROM 'shipping' THEN
    SELECT *
    INTO r_payout
    FROM public.payouts
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payout_not_found';
    END IF;

    IF r_payout.status IS DISTINCT FROM 'pending' OR r_payout.released_at IS NULL THEN
      RAISE EXCEPTION 'shipping_payout_not_cleared_for_wallet_release';
    END IF;
  END IF;

  v_earn := r_order.seller_earnings;
  IF v_earn IS NULL OR v_earn < 0 THEN
    RAISE EXCEPTION 'invalid_earnings';
  END IF;

  SELECT COALESCE(l.title, 'Item')
  INTO v_listing_title
  FROM public.listings l
  WHERE l.id = r_order.listing_id;

  SELECT *
  INTO r_wallet
  FROM public.wallets
  WHERE user_id = r_order.seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id)
    VALUES (r_order.seller_id)
    RETURNING *
    INTO r_wallet;
  END IF;

  v_earn := LEAST(v_earn, round(r_wallet.pending_balance::numeric, 2));
  IF v_earn <= 0 THEN
    RAISE EXCEPTION 'pending_balance_insufficient';
  END IF;

  v_pm_suffix :=
    CASE WHEN r_order.payment_method = 'stripe' THEN ', card' ELSE '' END;

  v_desc :=
    format(
      'Available — Sold "%s" (7%% fee: $%s%s)',
      v_listing_title,
      trim(to_char(r_order.platform_fee, 'FM999999990.00')),
      v_pm_suffix
    );

  v_new_pending := round(r_wallet.pending_balance::numeric - v_earn, 2);
  v_new_bal := round(r_wallet.balance::numeric + v_earn, 2);

  IF v_new_pending < 0 THEN
    v_new_pending := 0;
  END IF;

  UPDATE public.wallets w
  SET
    balance = v_new_bal,
    pending_balance = v_new_pending,
    updated_at = now()
  WHERE w.id = r_wallet.id;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_after,
    description,
    reference_id,
    reference_type
  )
  VALUES (
    r_wallet.id,
    r_order.seller_id,
    'sale',
    0,
    v_new_bal,
    v_desc,
    p_order_id::text,
    'order_seller_earnings'
  );

  RETURN true;
END;
$$;
