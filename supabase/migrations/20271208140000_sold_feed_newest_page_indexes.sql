-- Scale /sold reads: newest-page index scan, not a full rebuild of every sale.
-- Checkout holds: drop terminal rows so the table stays proportional to open
-- checkouts, not lifetime order volume.

CREATE INDEX IF NOT EXISTS orders_confirmed_created_id_idx
  ON public.orders (created_at DESC, id DESC)
  WHERE status = 'confirmed' AND is_admin_test = false;

COMMENT ON INDEX public.orders_confirmed_created_id_idx IS
  'Newest confirmed checkouts for /sold pagination. Walk this, stop at LIMIT.';

DROP FUNCTION IF EXISTS public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text,
  uuid
);

CREATE FUNCTION public.marketplace_sold_listing_page(
  p_limit integer,
  p_sections text[],
  p_before_sale_at timestamptz DEFAULT NULL,
  p_before_listing_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_brand_name text DEFAULT NULL,
  p_before_sale_line_id uuid DEFAULT NULL
)
RETURNS TABLE(
  listing_id uuid,
  sale_confirmed_at timestamptz,
  quantity integer,
  sale_line_id uuid,
  line_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH params AS (
    SELECT LEAST(GREATEST(p_limit, 1), 100) AS n
  ),
  checkout_lines AS (
    SELECT
      oi.id AS sale_line_id,
      oi.listing_id AS lid,
      o.created_at AS sale_at,
      GREATEST(oi.quantity, 1)::integer AS quantity,
      (oi.item_price * GREATEST(oi.quantity, 1))::numeric AS line_total
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    INNER JOIN public.listings l ON l.id = oi.listing_id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND l.section = ANY (p_sections)
      AND l.title NOT ILIKE 'Admin seed%'
      AND l.status IN ('sold', 'active')
      AND (
        l.hidden_from_site = false
        OR l.archived_at IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM public.orders o_vis
          WHERE o_vis.listing_id = l.id
            AND o_vis.status = 'confirmed'
            AND o_vis.is_admin_test = false
            AND o_vis.sales_channel = 'admin_terminal'
        )
      )
      AND (
        (p_brand_id IS NULL AND p_brand_name IS NULL)
        OR l.brand_id = p_brand_id
        OR (
          p_brand_name IS NOT NULL
          AND l.brand ILIKE ('%' || p_brand_name || '%')
        )
      )
      AND (
        p_before_sale_at IS NULL
        OR o.created_at < p_before_sale_at
        OR (
          o.created_at = p_before_sale_at
          AND (
            (p_before_sale_line_id IS NOT NULL AND oi.id < p_before_sale_line_id)
            OR (p_before_sale_line_id IS NULL AND oi.listing_id < p_before_listing_id)
          )
        )
      )
    ORDER BY o.created_at DESC, oi.id DESC
    LIMIT (SELECT n FROM params)
  ),
  legacy_lines AS (
    SELECT
      o.id AS sale_line_id,
      o.listing_id AS lid,
      o.created_at AS sale_at,
      1 AS quantity,
      NULL::numeric AS line_total
    FROM public.orders o
    INNER JOIN public.listings l ON l.id = o.listing_id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
      )
      AND l.section = ANY (p_sections)
      AND l.title NOT ILIKE 'Admin seed%'
      AND l.status IN ('sold', 'active')
      AND (
        l.hidden_from_site = false
        OR l.archived_at IS NOT NULL
        OR o.sales_channel = 'admin_terminal'
      )
      AND (
        (p_brand_id IS NULL AND p_brand_name IS NULL)
        OR l.brand_id = p_brand_id
        OR (
          p_brand_name IS NOT NULL
          AND l.brand ILIKE ('%' || p_brand_name || '%')
        )
      )
      AND (
        p_before_sale_at IS NULL
        OR o.created_at < p_before_sale_at
        OR (
          o.created_at = p_before_sale_at
          AND (
            (p_before_sale_line_id IS NOT NULL AND o.id < p_before_sale_line_id)
            OR (p_before_sale_line_id IS NULL AND o.listing_id < p_before_listing_id)
          )
        )
      )
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT (SELECT n FROM params)
  ),
  tip_lines AS (
    SELECT
      sst.id AS sale_line_id,
      sst.listing_id AS lid,
      COALESCE(sst.succeeded_at, sst.created_at) AS sale_at,
      1 AS quantity,
      NULL::numeric AS line_total
    FROM public.seller_sale_tips sst
    INNER JOIN public.listings l ON l.id = sst.listing_id
    WHERE sst.status = 'succeeded'
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_items oi
        INNER JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.listing_id = sst.listing_id
          AND o.status = 'confirmed'
          AND o.is_admin_test = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.listing_id = sst.listing_id
          AND o.status = 'confirmed'
          AND o.is_admin_test = false
          AND NOT EXISTS (
            SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
          )
      )
      AND l.section = ANY (p_sections)
      AND l.title NOT ILIKE 'Admin seed%'
      AND l.status IN ('sold', 'active')
      AND (
        l.hidden_from_site = false
        OR l.archived_at IS NOT NULL
      )
      AND (
        (p_brand_id IS NULL AND p_brand_name IS NULL)
        OR l.brand_id = p_brand_id
        OR (
          p_brand_name IS NOT NULL
          AND l.brand ILIKE ('%' || p_brand_name || '%')
        )
      )
      AND (
        p_before_sale_at IS NULL
        OR COALESCE(sst.succeeded_at, sst.created_at) < p_before_sale_at
        OR (
          COALESCE(sst.succeeded_at, sst.created_at) = p_before_sale_at
          AND (
            (p_before_sale_line_id IS NOT NULL AND sst.id < p_before_sale_line_id)
            OR (p_before_sale_line_id IS NULL AND sst.listing_id < p_before_listing_id)
          )
        )
      )
    ORDER BY COALESCE(sst.succeeded_at, sst.created_at) DESC, sst.id DESC
    LIMIT (SELECT n FROM params)
  )
  SELECT
    x.lid AS listing_id,
    x.sale_at AS sale_confirmed_at,
    x.quantity,
    x.sale_line_id,
    x.line_total
  FROM (
    SELECT * FROM checkout_lines
    UNION ALL
    SELECT * FROM legacy_lines
    UNION ALL
    SELECT * FROM tip_lines
  ) x
  ORDER BY x.sale_at DESC, x.sale_line_id DESC
  LIMIT (SELECT n FROM params);
$function$;

COMMENT ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text,
  uuid
) IS
  'Newest-page /sold scan. Each arm is LIMIT-capped so the read stays proportional to page size, not lifetime orders.';

REVOKE ALL ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text,
  uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text,
  uuid
) TO anon;
GRANT EXECUTE ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text,
  uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text,
  uuid
) TO service_role;

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

  DELETE FROM public.checkout_stock_holds
  WHERE status IN ('captured', 'released')
    AND created_at < now() - interval '14 days';

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_checkout_sessions() IS
  'Expires open sessions past TTL and deletes terminal stock holds older than 14 days.';
