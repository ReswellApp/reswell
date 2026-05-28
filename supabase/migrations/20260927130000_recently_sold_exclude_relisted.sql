-- Recently sold feeds must only include surfboards that are still sold on-marketplace.
-- Refunded-and-relisted boards (status active) and voided sales (no confirmed order) are excluded.

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

    UNION ALL

    SELECT o.listing_id, o.created_at
    FROM public.orders o
    WHERE o.status = 'confirmed'
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

COMMENT ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) IS
  'Surfboard listing ids ordered by newest confirmed-order time; excludes relisted (active) and voided sales.';

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

    UNION ALL

    SELECT o.listing_id, NULL::numeric, o.amount
    FROM public.orders o
    WHERE o.status = 'confirmed'
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

COMMENT ON FUNCTION public.marketplace_surfboard_confirmed_sale_stats() IS
  'Headline marketplace surfboard totals: confirmed checkout only; excludes relisted inventory.';
