-- Order-based seller earnings aggregates for the Earnings dashboard.
-- Uses auth.uid(); SECURITY DEFINER performs aggregation in one round trip without exposing other users' data.
-- Fully refunded orders are excluded; refunding / pending / confirmed sales count until refund completes.

CREATE OR REPLACE FUNCTION public.get_my_seller_earnings_totals()
RETURNS TABLE (
  lifetime_sold_usd numeric,
  earned_last_30d_usd numeric,
  earned_last_90d_usd numeric,
  earned_last_365d_usd numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.status IS DISTINCT FROM 'refunded'
        ),
        2
      ),
      0
    )::numeric AS lifetime_sold_usd,
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.status IS DISTINCT FROM 'refunded'
            AND o.created_at >= now() - interval '30 days'
        ),
        2
      ),
      0
    )::numeric AS earned_last_30d_usd,
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.status IS DISTINCT FROM 'refunded'
            AND o.created_at >= now() - interval '90 days'
        ),
        2
      ),
      0
    )::numeric AS earned_last_90d_usd,
    COALESCE(
      ROUND(
        (
          SELECT SUM(o.seller_earnings::numeric)
          FROM public.orders o
          WHERE o.seller_id = auth.uid()
            AND o.status IS DISTINCT FROM 'refunded'
            AND o.created_at >= now() - interval '365 days'
        ),
        2
      ),
      0
    )::numeric AS earned_last_365d_usd;
$$;

COMMENT ON FUNCTION public.get_my_seller_earnings_totals() IS
  'Dashboard: sums orders.seller_earnings for the current user (excludes status=refunded).';

REVOKE ALL ON FUNCTION public.get_my_seller_earnings_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_seller_earnings_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller_earnings_totals() TO service_role;
