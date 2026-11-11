-- /sold is every confirmed checkout that was not refunded.
-- Quantity SKUs stay `active` after a unit sells; leftover stock must not hide
-- that checkout. Hide-from-site still removes a listing from browse / PDP, not
-- from this feed. Off-platform tipped marks stay subject to hide-from-site.

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
      AND l.status IS DISTINCT FROM 'draft'
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_item_returns r
        WHERE r.status = 'refunded'
          AND r.order_id = o.id
          AND (
            r.order_item_id = oi.id
            OR (r.order_item_id IS NULL AND r.listing_id = oi.listing_id)
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
      AND l.status IS DISTINCT FROM 'draft'
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_item_returns r
        WHERE r.status = 'refunded'
          AND r.order_id = o.id
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
      AND l.status IS DISTINCT FROM 'draft'
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
  'Newest-page /sold scan. Each confirmed, non-refunded checkout is a tile — leftover quantity stock does not hide the sale.';

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

CREATE OR REPLACE FUNCTION public.marketplace_listing_confirmed_sale_stats(p_sections text[])
RETURNS TABLE(items_sold bigint, gmv_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH checkout_lines AS (
    SELECT
      oi.listing_id AS lid,
      (oi.item_price * GREATEST(oi.quantity, 1))::numeric AS line_item_price,
      o.amount AS order_amount,
      GREATEST(oi.quantity, 1)::integer AS quantity,
      'checkout'::text AS source
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_item_returns r
        WHERE r.status = 'refunded'
          AND r.order_id = o.id
          AND (
            r.order_item_id = oi.id
            OR (r.order_item_id IS NULL AND r.listing_id = oi.listing_id)
          )
      )

    UNION ALL

    SELECT o.listing_id, NULL::numeric, o.amount, 1, 'checkout'::text
    FROM public.orders o
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_item_returns r
        WHERE r.status = 'refunded'
          AND r.order_id = o.id
      )
  ),
  tipped_lines AS (
    SELECT sst.listing_id AS lid, MAX(l.price)::numeric AS listing_price
    FROM public.seller_sale_tips sst
    INNER JOIN public.listings l ON l.id = sst.listing_id
    WHERE sst.status = 'succeeded'
      AND l.price > 0
    GROUP BY sst.listing_id
  ),
  sale_lines AS (
    SELECT lid, line_item_price, order_amount, quantity, source
    FROM checkout_lines

    UNION ALL

    SELECT t.lid, t.listing_price, t.listing_price, 1, 'tip'::text
    FROM tipped_lines t
    WHERE NOT EXISTS (
      SELECT 1
      FROM checkout_lines c
      WHERE c.lid = t.lid
    )
  ),
  qualifying AS (
    SELECT
      COALESCE(sl.line_item_price, sl.order_amount)::numeric AS rev,
      sl.quantity
    FROM sale_lines sl
    INNER JOIN public.listings l ON l.id = sl.lid
    WHERE l.section = ANY(p_sections)
      AND l.status IS DISTINCT FROM 'draft'
      AND l.title NOT ILIKE 'Admin seed%'
      AND (
        sl.source = 'checkout'
        OR l.hidden_from_site = false
        OR l.archived_at IS NOT NULL
      )
  )
  SELECT
    COALESCE(SUM(q.quantity), 0)::bigint AS items_sold,
    COALESCE(SUM(q.rev), 0)::numeric AS gmv_total
  FROM qualifying q;
$function$;

COMMENT ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) IS
  'Headline GMS from confirmed non-refunded checkouts and tipped mark-as-sold rows. Leftover quantity stock does not exclude the sale.';

GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO service_role;
