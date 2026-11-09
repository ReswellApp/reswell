-- Balance-sheet rows are derived from listings and orders, so user-requested
-- removal is recorded separately instead of deleting marketplace records.

CREATE TABLE public.seller_balance_sheet_exclusions (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, listing_id)
);

ALTER TABLE public.seller_balance_sheet_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller_balance_sheet_exclusions_select_own"
  ON public.seller_balance_sheet_exclusions
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "seller_balance_sheet_exclusions_insert_own"
  ON public.seller_balance_sheet_exclusions
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.listings
      WHERE listings.id = listing_id
        AND listings.user_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.seller_balance_sheet_exclusions FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE public.seller_balance_sheet_exclusions TO authenticated;

CREATE VIEW public.visible_seller_balance_sheet_entries
WITH (security_invoker = true)
AS
SELECT entry.*
FROM public.seller_balance_sheet_entries AS entry
WHERE NOT EXISTS (
  SELECT 1
  FROM public.seller_balance_sheet_exclusions AS exclusion
  WHERE exclusion.owner_id = entry.owner_id
    AND exclusion.listing_id = entry.listing_id
);

COMMENT ON VIEW public.visible_seller_balance_sheet_entries IS
  'Seller balance-sheet entries excluding listings the owner removed from their balance sheet.';

GRANT SELECT ON public.visible_seller_balance_sheet_entries TO authenticated;

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
  FROM public.visible_seller_balance_sheet_entries AS entry
  WHERE entry.owner_id = auth.uid()
    AND (
      p_listing_section IS NULL
      OR entry.listing_section = p_listing_section
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_balance_sheet_summary_by_section(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_balance_sheet_summary_by_section(text) TO authenticated;
