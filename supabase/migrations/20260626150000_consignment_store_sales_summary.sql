-- Accurate store sales rollups for the operator dashboard (no 1000-row scan cap).

DROP FUNCTION IF EXISTS public.consignment_store_sales_summary(uuid);

CREATE FUNCTION public.consignment_store_sales_summary(p_store_id uuid)
RETURNS TABLE(
  order_count bigint,
  gross_sales_usd numeric,
  shop_earnings_usd numeric,
  consignor_paid_usd numeric,
  today_order_count bigint,
  today_gross_usd numeric,
  today_shop_earnings_usd numeric,
  pos_order_count bigint,
  online_order_count bigint,
  cash_order_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH base AS (
    SELECT
      o.amount,
      o.shop_net_earnings,
      o.consignor_earnings,
      o.sales_channel,
      o.payment_method,
      o.status,
      o.created_at
    FROM public.orders o
    WHERE o.consignment_store_id = p_store_id
      AND o.status = 'confirmed'
      AND o.is_admin_test = false
  ),
  today AS (
    SELECT *
    FROM base
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
  )
  SELECT
    COUNT(*)::bigint AS order_count,
    COALESCE(SUM(b.amount), 0)::numeric AS gross_sales_usd,
    COALESCE(SUM(b.shop_net_earnings), 0)::numeric AS shop_earnings_usd,
    COALESCE(SUM(b.consignor_earnings), 0)::numeric AS consignor_paid_usd,
    (SELECT COUNT(*)::bigint FROM today) AS today_order_count,
    COALESCE((SELECT SUM(t.amount) FROM today t), 0)::numeric AS today_gross_usd,
    COALESCE((SELECT SUM(t.shop_net_earnings) FROM today t), 0)::numeric AS today_shop_earnings_usd,
    COUNT(*) FILTER (WHERE b.sales_channel = 'pos')::bigint AS pos_order_count,
    COUNT(*) FILTER (WHERE b.sales_channel = 'online')::bigint AS online_order_count,
    COUNT(*) FILTER (WHERE b.payment_method = 'cash')::bigint AS cash_order_count
  FROM base b;
$function$;

COMMENT ON FUNCTION public.consignment_store_sales_summary(uuid) IS
  'Lifetime + today sales totals for a consignment store operator dashboard.';

REVOKE ALL ON FUNCTION public.consignment_store_sales_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consignment_store_sales_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consignment_store_sales_summary(uuid) TO service_role;
