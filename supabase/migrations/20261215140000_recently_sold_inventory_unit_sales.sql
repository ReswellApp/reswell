-- Sold feed: one row per confirmed checkout (not one per listing).
-- Sync-managed / Shopify inventory listings stay active but each unit sold appears on /sold.

BEGIN;

DROP FUNCTION IF EXISTS public.recently_sold_surfboard_listing_sale_times(integer);
DROP FUNCTION IF EXISTS public.recently_sold_listing_sale_times(integer, text[]);

CREATE FUNCTION public.recently_sold_listing_sale_times(
  p_limit integer,
  p_sections text[]
)
RETURNS TABLE(listing_id uuid, order_id uuid, sale_confirmed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH sale_lines AS (
    SELECT oi.listing_id AS lid, o.id AS oid, o.created_at AS sale_at
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false

    UNION ALL

    SELECT o.listing_id, o.id, o.created_at
    FROM public.orders o
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false
      AND o.listing_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  )
  SELECT sl.lid AS listing_id, sl.oid AS order_id, sl.sale_at AS sale_confirmed_at
  FROM sale_lines sl
  INNER JOIN public.listings l ON l.id = sl.lid
  WHERE l.section = ANY(p_sections)
    AND l.title NOT ILIKE 'Admin seed%'
    AND (l.hidden_from_site = false OR l.archived_at IS NOT NULL)
    AND (
      (l.sync_managed = true AND l.status IN ('active', 'removed', 'sold'))
      OR (COALESCE(l.sync_managed, false) = false AND l.status = 'sold')
    )
  ORDER BY sl.sale_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 120);
$function$;

COMMENT ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) IS
  'One row per confirmed checkout: listing_id, order_id, sale time. Includes each sale from sync-managed inventory listings (listing may stay active). P2P listings require status=sold.';

REVOKE ALL ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) TO service_role;

CREATE FUNCTION public.recently_sold_surfboard_listing_sale_times(p_limit integer)
RETURNS TABLE(listing_id uuid, order_id uuid, sale_confirmed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT *
  FROM public.recently_sold_listing_sale_times(p_limit, ARRAY['surfboards']::text[]);
$function$;

COMMENT ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) IS
  'Surfboard sales ordered by newest confirmed checkout; wrapper around recently_sold_listing_sale_times.';

REVOKE ALL ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.marketplace_listing_confirmed_sale_stats(p_sections text[])
RETURNS TABLE(items_sold bigint, gmv_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH sale_lines AS (
    SELECT oi.listing_id AS lid, o.id AS oid, oi.item_price AS line_item_price, o.amount AS order_amount
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'confirmed'
      AND o.is_admin_test = false

    UNION ALL

    SELECT o.listing_id, o.id, NULL::numeric, o.amount
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
    WHERE l.section = ANY(p_sections)
      AND l.title NOT ILIKE 'Admin seed%'
      AND (l.hidden_from_site = false OR l.archived_at IS NOT NULL)
      AND (
        (l.sync_managed = true AND l.status IN ('active', 'removed', 'sold'))
        OR (COALESCE(l.sync_managed, false) = false AND l.status = 'sold')
      )
  )
  SELECT
    COUNT(*)::bigint AS items_sold,
    COALESCE(SUM(q.rev), 0)::numeric AS gmv_total
  FROM qualifying q;
$function$;

COMMENT ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) IS
  'Headline marketplace totals: counts every confirmed checkout line, including repeat sales from sync-managed inventory listings.';

COMMIT;
