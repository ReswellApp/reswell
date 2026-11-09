-- /sold includes every peer category. Brand-new listings with remaining stock
-- stay active after a unit sells. Each checkout of that listing is its own
-- sold tile, including how many units sold together. Refunded used listings
-- that were relisted stay out.

DROP FUNCTION IF EXISTS public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text
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
  WITH events AS (
    SELECT
      oi.id AS sale_line_id,
      oi.listing_id AS lid,
      o.created_at AS sale_at,
      GREATEST(oi.quantity, 1)::integer AS quantity,
      (oi.item_price * GREATEST(oi.quantity, 1))::numeric AS line_total,
      'checkout'::text AS source
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false

    UNION ALL

    SELECT
      o.id,
      o.listing_id,
      o.created_at,
      1,
      NULL::numeric,
      'checkout'::text
    FROM public.orders o
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      )

    UNION ALL

    SELECT
      sst.id,
      sst.listing_id,
      COALESCE(sst.succeeded_at, sst.created_at),
      1,
      NULL::numeric,
      'tip'::text
    FROM public.seller_sale_tips sst
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
            SELECT 1
            FROM public.order_items oi
            WHERE oi.order_id = o.id
          )
      )
  ),
  filtered AS (
    SELECT
      e.sale_line_id,
      e.lid,
      e.sale_at,
      e.quantity,
      e.line_total,
      l.condition,
      ROW_NUMBER() OVER (
        PARTITION BY e.lid
        ORDER BY e.sale_at DESC, e.sale_line_id DESC
      ) AS sale_rank
    FROM events e
    INNER JOIN public.listings l ON l.id = e.lid
    WHERE l.section = ANY(p_sections)
      AND l.title NOT ILIKE 'Admin seed%'
      AND (
        l.status = 'sold'
        OR (
          e.source = 'checkout'
          AND l.status = 'active'
          AND l.condition IN ('brand_new', 'new')
          AND COALESCE(l.stock_quantity, 0) > 0
          AND l.hidden_from_site = false
          AND l.archived_at IS NULL
        )
      )
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
  )
  SELECT
    f.lid AS listing_id,
    f.sale_at AS sale_confirmed_at,
    f.quantity,
    f.sale_line_id,
    f.line_total
  FROM filtered f
  WHERE (
    f.sale_rank = 1
    OR f.condition IN ('brand_new', 'new')
  )
  AND (
    p_before_sale_at IS NULL
    OR f.sale_at < p_before_sale_at
    OR (
      f.sale_at = p_before_sale_at
      AND (
        (p_before_sale_line_id IS NOT NULL AND f.sale_line_id < p_before_sale_line_id)
        OR (p_before_sale_line_id IS NULL AND f.lid < p_before_listing_id)
      )
    )
  )
  ORDER BY f.sale_at DESC, f.sale_line_id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
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
  'Cursor-paginated /sold feed. Brand-new quantity listings get one tile per checkout, with the units sold together. Other listings stay one tile.';

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

    UNION ALL

    SELECT o.listing_id, NULL::numeric, o.amount, 1, 'checkout'::text
    FROM public.orders o
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
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
      AND (
        l.status = 'sold'
        OR (
          sl.source = 'checkout'
          AND l.status = 'active'
          AND l.condition IN ('brand_new', 'new')
          AND COALESCE(l.stock_quantity, 0) > 0
          AND l.hidden_from_site = false
          AND l.archived_at IS NULL
        )
      )
      AND l.title NOT ILIKE 'Admin seed%'
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
  )
  SELECT
    COALESCE(SUM(q.quantity), 0)::bigint AS items_sold,
    COALESCE(SUM(q.rev), 0)::numeric AS gmv_total
  FROM qualifying q;
$function$;

COMMENT ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) IS
  'Headline GMS: confirmed checkout units (including in-stock brand-new quantity) plus listing prices of sold listings with a succeeded seller tip (no double-count).';

GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO service_role;
