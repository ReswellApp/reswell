-- Include off-platform "mark as sold" listings in the public /sold feed once the
-- seller has successfully tipped Reswell. Confirmed checkouts stay in the feed as before.

CREATE INDEX IF NOT EXISTS seller_sale_tips_succeeded_feed_idx
  ON public.seller_sale_tips (listing_id, succeeded_at DESC)
  WHERE status = 'succeeded';

CREATE OR REPLACE FUNCTION public.marketplace_sold_listing_page(
  p_limit integer,
  p_sections text[],
  p_before_sale_at timestamptz DEFAULT NULL,
  p_before_listing_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_brand_name text DEFAULT NULL
)
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
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      )

    UNION ALL

    SELECT sst.listing_id, COALESCE(sst.succeeded_at, sst.created_at)
    FROM public.seller_sale_tips sst
    WHERE sst.status = 'succeeded'
  ),
  per_listing AS (
    SELECT sl.lid, MAX(sl.sale_at)::timestamptz AS sale_confirmed_at
    FROM sale_lines sl
    GROUP BY sl.lid
  )
  SELECT pl.lid AS listing_id, pl.sale_confirmed_at
  FROM per_listing pl
  INNER JOIN public.listings l ON l.id = pl.lid
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
      OR pl.sale_confirmed_at < p_before_sale_at
      OR (
        pl.sale_confirmed_at = p_before_sale_at
        AND pl.lid < p_before_listing_id
      )
    )
  ORDER BY pl.sale_confirmed_at DESC, pl.lid DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$function$;

COMMENT ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text
) IS
  'Cursor-paginated /sold feed: confirmed marketplace checkouts plus listings with a succeeded seller tip.';

GRANT EXECUTE ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text
) TO anon;
GRANT EXECUTE ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_sold_listing_page(
  integer,
  text[],
  timestamptz,
  uuid,
  uuid,
  text
) TO service_role;
