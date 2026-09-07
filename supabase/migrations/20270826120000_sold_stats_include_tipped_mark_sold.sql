-- Include listing prices of off-platform "mark as sold" sales in public GMS
-- once the seller has successfully tipped Reswell. Confirmed checkouts stay as
-- before; a listing that already has a confirmed order is not counted twice.

CREATE OR REPLACE FUNCTION public.marketplace_listing_confirmed_sale_stats(p_sections text[])
RETURNS TABLE(items_sold bigint, gmv_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH checkout_lines AS (
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
  tipped_lines AS (
    SELECT sst.listing_id AS lid, MAX(l.price)::numeric AS listing_price
    FROM public.seller_sale_tips sst
    INNER JOIN public.listings l ON l.id = sst.listing_id
    WHERE sst.status = 'succeeded'
      AND l.price > 0
    GROUP BY sst.listing_id
  ),
  sale_lines AS (
    SELECT lid, line_item_price, order_amount
    FROM checkout_lines

    UNION ALL

    SELECT t.lid, t.listing_price, t.listing_price
    FROM tipped_lines t
    WHERE NOT EXISTS (
      SELECT 1
      FROM checkout_lines c
      WHERE c.lid = t.lid
    )
  ),
  qualifying AS (
    SELECT COALESCE(sl.line_item_price, sl.order_amount)::numeric AS rev
    FROM sale_lines sl
    INNER JOIN public.listings l ON l.id = sl.lid
    WHERE l.section = ANY(p_sections)
      AND l.status = 'sold'
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
    COUNT(*)::bigint AS items_sold,
    COALESCE(SUM(q.rev), 0)::numeric AS gmv_total
  FROM qualifying q;
$function$;

COMMENT ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) IS
  'Headline GMS: confirmed checkout totals plus listing prices of sold listings with a succeeded seller tip (no double-count).';

GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_listing_confirmed_sale_stats(text[]) TO service_role;
