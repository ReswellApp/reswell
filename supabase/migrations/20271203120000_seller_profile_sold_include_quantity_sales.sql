-- Seller shop Sold tab previously only queried listings.status = 'sold'.
-- Brand-new peer quantity listings stay active after a unit sells (stock
-- decrements until the last unit). Mirror /sold eligibility so those sales
-- appear on /sellers/[slug] Sold history while stock remains.

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
        AND l.condition IN ('brand_new', 'new')
        AND COALESCE(l.stock_quantity, 0) > 0
        AND l.hidden_from_site = false
        AND l.archived_at IS NULL
      )
    GROUP BY e.lid
  ),
  -- Mark-as-sold / exhausted stock rows with no order or tip row still belong
  -- on the shop Sold tab.
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
  'Seller shop Sold tab listing ids. Includes fully sold rows and in-stock brand-new quantity sales (same eligibility as /sold).';

REVOKE ALL ON FUNCTION public.seller_profile_sold_listing_ids(uuid, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_profile_sold_listing_ids(uuid, text[], integer) TO anon;
GRANT EXECUTE ON FUNCTION public.seller_profile_sold_listing_ids(uuid, text[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_profile_sold_listing_ids(uuid, text[], integer) TO service_role;
