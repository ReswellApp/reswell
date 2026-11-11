-- Period-aware balance-sheet P&L. Inventory totals stay current; realized
-- sales/profit honor this-month, rolling-3-month, or all-time windows.

CREATE OR REPLACE FUNCTION public.get_my_balance_sheet_summary_filtered(
  p_listing_section text DEFAULT NULL,
  p_period text DEFAULT 'all'
)
RETURNS TABLE (
  inventory_listings bigint,
  inventory_asking_value numeric,
  inventory_cost_basis numeric,
  realized_sales bigint,
  gross_sales numeric,
  reswell_fees numeric,
  recorded_cost_basis numeric,
  realized_profit numeric,
  missing_cost_basis bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT CASE lower(COALESCE(p_period, 'all'))
      WHEN 'month' THEN date_trunc('month', timezone('utc', now()))
      WHEN '3m' THEN timezone('utc', now()) - interval '3 months'
      ELSE NULL::timestamptz
    END AS sold_since
  )
  SELECT
    COUNT(*) FILTER (WHERE entry.sale_source = 'inventory')::bigint,
    COALESCE(
      SUM(entry.sold_price) FILTER (WHERE entry.sale_source = 'inventory'),
      0
    )::numeric,
    COALESCE(
      SUM(entry.purchase_price) FILTER (WHERE entry.sale_source = 'inventory'),
      0
    )::numeric,
    COUNT(*) FILTER (
      WHERE entry.sale_source <> 'inventory'
        AND (
          (SELECT sold_since FROM bounds) IS NULL
          OR entry.sold_at >= (SELECT sold_since FROM bounds)
        )
    )::bigint,
    COALESCE(
      SUM(entry.sold_price) FILTER (
        WHERE entry.sale_source <> 'inventory'
          AND (
            (SELECT sold_since FROM bounds) IS NULL
            OR entry.sold_at >= (SELECT sold_since FROM bounds)
          )
      ),
      0
    )::numeric,
    COALESCE(
      SUM(entry.reswell_fee) FILTER (
        WHERE entry.sale_source <> 'inventory'
          AND (
            (SELECT sold_since FROM bounds) IS NULL
            OR entry.sold_at >= (SELECT sold_since FROM bounds)
          )
      ),
      0
    )::numeric,
    COALESCE(
      SUM(entry.purchase_price) FILTER (
        WHERE entry.sale_source <> 'inventory'
          AND (
            (SELECT sold_since FROM bounds) IS NULL
            OR entry.sold_at >= (SELECT sold_since FROM bounds)
          )
      ),
      0
    )::numeric,
    COALESCE(
      SUM(entry.profit) FILTER (
        WHERE entry.sale_source <> 'inventory'
          AND (
            (SELECT sold_since FROM bounds) IS NULL
            OR entry.sold_at >= (SELECT sold_since FROM bounds)
          )
      ),
      0
    )::numeric,
    COUNT(*) FILTER (
      WHERE entry.purchase_price IS NULL
        AND (
          entry.sale_source = 'inventory'
          OR (SELECT sold_since FROM bounds) IS NULL
          OR entry.sold_at >= (SELECT sold_since FROM bounds)
        )
    )::bigint
  FROM public.visible_seller_balance_sheet_entries AS entry
  WHERE entry.owner_id = auth.uid()
    AND (
      p_listing_section IS NULL
      OR entry.listing_section = p_listing_section
    );
$$;

COMMENT ON FUNCTION public.get_my_balance_sheet_summary_filtered(text, text) IS
  'Seller balance-sheet summary with optional category and P&L period (month, 3m, all).';

REVOKE ALL ON FUNCTION public.get_my_balance_sheet_summary_filtered(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_balance_sheet_summary_filtered(text, text) TO authenticated;
