-- Category-filtered balance-sheet totals. Keep the original no-argument RPC
-- for older application deployments during rollout.

CREATE OR REPLACE FUNCTION public.get_my_balance_sheet_summary_by_section(
  p_listing_section text DEFAULT NULL
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
    COUNT(*) FILTER (WHERE entry.sale_source <> 'inventory')::bigint,
    COALESCE(
      SUM(entry.sold_price) FILTER (WHERE entry.sale_source <> 'inventory'),
      0
    )::numeric,
    COALESCE(
      SUM(entry.reswell_fee) FILTER (WHERE entry.sale_source <> 'inventory'),
      0
    )::numeric,
    COALESCE(
      SUM(entry.purchase_price) FILTER (WHERE entry.sale_source <> 'inventory'),
      0
    )::numeric,
    COALESCE(
      SUM(entry.profit) FILTER (WHERE entry.sale_source <> 'inventory'),
      0
    )::numeric,
    COUNT(*) FILTER (WHERE entry.purchase_price IS NULL)::bigint
  FROM public.seller_balance_sheet_entries AS entry
  WHERE entry.owner_id = auth.uid()
    AND (
      p_listing_section IS NULL
      OR entry.listing_section = p_listing_section
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_balance_sheet_summary_by_section(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_balance_sheet_summary_by_section(text) TO authenticated;
