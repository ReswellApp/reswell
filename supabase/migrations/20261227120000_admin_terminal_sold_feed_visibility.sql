-- Admin terminal checkout: confirmed in-person sales appear on /sold even when the listing
-- was hidden_from_site (common for in-store inventory). Online-only hide rules unchanged.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'online';

ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_required_unless_pos;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_sales_channel_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_sales_channel_check;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_sales_channel_check
  CHECK (sales_channel IN ('online', 'admin_terminal', 'pos', 'off_platform'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_required_unless_admin_terminal'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_buyer_required_unless_admin_terminal
      CHECK (buyer_id IS NOT NULL OR sales_channel = 'admin_terminal');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_sales_channel_idx ON public.orders (sales_channel);

CREATE OR REPLACE FUNCTION public.recently_sold_listing_sale_times(
  p_limit integer,
  p_sections text[]
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
  ORDER BY pl.sale_confirmed_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 120);
$function$;

COMMENT ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) IS
  'Peer listing ids from confirmed checkout; admin-terminal hidden inventory included on public sold feeds.';

CREATE OR REPLACE FUNCTION public.marketplace_listing_confirmed_sale_stats(p_sections text[])
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
  'Headline totals from confirmed checkout; admin-terminal hidden inventory included.';
