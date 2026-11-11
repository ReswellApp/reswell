-- /sold is checkout-based, not condition-based.
-- Brand new is not a special feed path. Quantity listings stay active while
-- stock remains; each confirmed checkout is still its own sold tile.
-- Shop (section = new) uses the same rules as peer.

DROP FUNCTION IF EXISTS public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text
);

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
  )
  SELECT
    e.lid AS listing_id,
    e.sale_at AS sale_confirmed_at,
    e.quantity,
    e.sale_line_id,
    e.line_total
  FROM events e
  INNER JOIN public.listings l ON l.id = e.lid
  WHERE l.section = ANY(p_sections)
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
      OR e.sale_at < p_before_sale_at
      OR (
        e.sale_at = p_before_sale_at
        AND (
          (p_before_sale_line_id IS NOT NULL AND e.sale_line_id < p_before_sale_line_id)
          OR (p_before_sale_line_id IS NULL AND e.lid < p_before_listing_id)
        )
      )
    )
  ORDER BY e.sale_at DESC, e.sale_line_id DESC
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
  'Cursor-paginated /sold feed. One tile per confirmed checkout (or tip). Quantity leftover stock does not hide the sale. Condition is not a gate.';

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
      AND l.status IN ('sold', 'active')
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
  'Headline GMS from confirmed checkouts and tipped mark-as-sold rows. Quantity leftover stock does not exclude the sale.';

GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.seller_profile_sold_listing_ids(
  p_seller_id uuid,
  p_sections text[],
  p_limit integer DEFAULT 150
)
RETURNS TABLE(
  listing_id uuid,
  last_sold_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH checkout_events AS (
    SELECT
      oi.listing_id AS lid,
      o.created_at AS sale_at,
      'checkout'::text AS source
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    INNER JOIN public.listings l ON l.id = oi.listing_id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND l.user_id = p_seller_id
      AND l.section = ANY (p_sections)
      AND l.title NOT ILIKE 'Admin seed%'

    UNION ALL

    SELECT
      o.listing_id,
      o.created_at,
      'checkout'::text
    FROM public.orders o
    INNER JOIN public.listings l ON l.id = o.listing_id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND l.user_id = p_seller_id
      AND l.section = ANY (p_sections)
      AND l.title NOT ILIKE 'Admin seed%'
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      )

    UNION ALL

    SELECT
      sst.listing_id,
      COALESCE(sst.succeeded_at, sst.created_at),
      'tip'::text
    FROM public.seller_sale_tips sst
    INNER JOIN public.listings l ON l.id = sst.listing_id
    WHERE sst.status = 'succeeded'
      AND l.user_id = p_seller_id
      AND l.section = ANY (p_sections)
      AND l.title NOT ILIKE 'Admin seed%'
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
  event_eligible AS (
    SELECT
      e.lid,
      MAX(e.sale_at) AS last_sold_at
    FROM checkout_events e
    INNER JOIN public.listings l ON l.id = e.lid
    WHERE
      l.status = 'sold'
      OR (
        e.source = 'checkout'
        AND l.status = 'active'
        AND l.hidden_from_site = false
        AND l.archived_at IS NULL
      )
    GROUP BY e.lid
  ),
  status_sold AS (
    SELECT
      l.id AS lid,
      COALESCE(e.last_sold_at, l.updated_at, l.created_at) AS last_sold_at
    FROM public.listings l
    LEFT JOIN event_eligible e ON e.lid = l.id
    WHERE l.user_id = p_seller_id
      AND l.section = ANY (p_sections)
      AND l.status = 'sold'
      AND l.title NOT ILIKE 'Admin seed%'
  ),
  combined AS (
    SELECT lid, last_sold_at FROM event_eligible
    UNION
    SELECT lid, last_sold_at FROM status_sold
  )
  SELECT
    c.lid AS listing_id,
    c.last_sold_at
  FROM combined c
  ORDER BY c.last_sold_at DESC NULLS LAST, c.lid DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 150), 1), 300);
$function$;

COMMENT ON FUNCTION public.seller_profile_sold_listing_ids(uuid, text[], integer) IS
  'Seller Sold tab listing ids. Confirmed checkouts while stock remains, plus fully sold rows. Condition is not a gate.';
