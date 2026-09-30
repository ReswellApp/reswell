-- Replace the manually synchronized admin P&L ledger with a seller-owned,
-- derived balance sheet. Acquisition metadata remains optional on listings;
-- inventory comes from listings, while realized sale economics always come
-- from checkout snapshots or succeeded off-platform sale tips.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS seller_purchased_from text,
  ADD COLUMN IF NOT EXISTS seller_purchased_on date;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_seller_purchased_from_length_check
  CHECK (
    seller_purchased_from IS NULL
    OR char_length(btrim(seller_purchased_from)) BETWEEN 1 AND 200
  );

COMMENT ON COLUMN public.listings.seller_purchased_from IS
  'Optional seller-only acquisition source; not shown to buyers.';
COMMENT ON COLUMN public.listings.seller_purchased_on IS
  'Optional seller-only acquisition date; not shown to buyers.';

-- The old manually maintained ledger is intentionally discarded. Listings,
-- orders, refunds, and succeeded tips are the only balance-sheet sources.
DROP TABLE IF EXISTS public.pnl_loan_repayments;
DROP TABLE IF EXISTS public.pnl_loans;
DROP TABLE IF EXISTS public.pnl_entries;
DROP FUNCTION IF EXISTS public.pnl_entries_set_updated_at();
DROP FUNCTION IF EXISTS public.pnl_loans_set_updated_at();
DROP FUNCTION IF EXISTS public.pnl_is_staff();

CREATE INDEX IF NOT EXISTS orders_seller_balance_sheet_idx
  ON public.orders (seller_id, created_at DESC)
  WHERE status = 'confirmed' AND is_admin_test = false;

CREATE INDEX IF NOT EXISTS seller_sale_tips_succeeded_seller_idx
  ON public.seller_sale_tips (seller_user_id, succeeded_at DESC)
  WHERE status = 'succeeded';

CREATE INDEX IF NOT EXISTS listings_off_platform_balance_sheet_idx
  ON public.listings (user_id, sold_off_platform_at DESC)
  WHERE status IN ('sold', 'removed') AND sold_off_platform = true;

CREATE INDEX IF NOT EXISTS listings_inventory_balance_sheet_idx
  ON public.listings (user_id, created_at DESC)
  WHERE status IN ('active', 'pending');

DROP VIEW IF EXISTS public.seller_balance_sheet_entries;
CREATE VIEW public.seller_balance_sheet_entries
WITH (security_invoker = true)
AS
WITH checkout_lines AS (
  -- Modern multi-item checkout rows: order_items is the per-listing economic
  -- snapshot and orders supplies lifecycle state.
  SELECT
    o.seller_id AS owner_id,
    'checkout:' || o.id::text || ':' || oi.listing_id::text AS entry_key,
    'reswell'::text AS sale_source,
    oi.listing_id,
    l.title AS listing_title,
    l.section AS listing_section,
    l.slug AS listing_slug,
    l.seller_purchase_price_usd AS purchase_price,
    l.seller_purchased_from AS purchased_from,
    l.seller_purchased_on AS purchased_on,
    oi.item_price AS sold_price,
    oi.platform_fee AS reswell_fee,
    oi.seller_earnings AS seller_proceeds,
    o.created_at AS sold_at,
    o.id AS order_id,
    o.order_num
  FROM public.orders AS o
  JOIN public.order_items AS oi ON oi.order_id = o.id
  JOIN public.listings AS l ON l.id = oi.listing_id
  WHERE o.status = 'confirmed'
    AND o.is_admin_test = false
    AND NOT EXISTS (
      SELECT 1
      FROM public.order_item_returns AS item_return
      WHERE item_return.order_id = o.id
        AND item_return.listing_id = oi.listing_id
        AND item_return.status = 'refunded'
    )

  UNION ALL

  -- Orders created before order_items existed retain their single listing and
  -- order-level snapshot.
  SELECT
    o.seller_id AS owner_id,
    'checkout:' || o.id::text || ':' || o.listing_id::text AS entry_key,
    'reswell'::text AS sale_source,
    o.listing_id,
    l.title AS listing_title,
    l.section AS listing_section,
    l.slug AS listing_slug,
    l.seller_purchase_price_usd AS purchase_price,
    l.seller_purchased_from AS purchased_from,
    l.seller_purchased_on AS purchased_on,
    GREATEST(0, o.amount - o.shipping_amount) AS sold_price,
    o.platform_fee AS reswell_fee,
    o.seller_earnings AS seller_proceeds,
    o.created_at AS sold_at,
    o.id AS order_id,
    o.order_num
  FROM public.orders AS o
  JOIN public.listings AS l ON l.id = o.listing_id
  WHERE o.status = 'confirmed'
    AND o.is_admin_test = false
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items AS oi WHERE oi.order_id = o.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.order_item_returns AS item_return
      WHERE item_return.order_id = o.id
        AND item_return.listing_id = o.listing_id
        AND item_return.status = 'refunded'
    )
),
tip_totals AS (
  SELECT
    tip.listing_id,
    tip.seller_user_id,
    SUM(tip.amount_cents)::numeric / 100 AS tip_amount,
    MIN(COALESCE(tip.succeeded_at, tip.created_at)) AS first_succeeded_at
  FROM public.seller_sale_tips AS tip
  JOIN public.listings AS tipped_listing ON tipped_listing.id = tip.listing_id
  WHERE tip.status = 'succeeded'
    -- A listing can be relisted and sold again. Tips from an earlier sale cycle
    -- must not become fees on the current sale.
    AND (
      tipped_listing.sold_off_platform_at IS NULL
      OR COALESCE(tip.succeeded_at, tip.created_at) >= tipped_listing.sold_off_platform_at
    )
  GROUP BY tip.listing_id, tip.seller_user_id
),
off_platform_lines AS (
  SELECT
    l.user_id AS owner_id,
    'off-platform:' || l.id::text AS entry_key,
    'off_platform'::text AS sale_source,
    l.id AS listing_id,
    l.title AS listing_title,
    l.section AS listing_section,
    l.slug AS listing_slug,
    l.seller_purchase_price_usd AS purchase_price,
    l.seller_purchased_from AS purchased_from,
    l.seller_purchased_on AS purchased_on,
    l.price AS sold_price,
    tips.tip_amount AS reswell_fee,
    GREATEST(0, l.price - tips.tip_amount) AS seller_proceeds,
    COALESCE(l.sold_off_platform_at, tips.first_succeeded_at) AS sold_at,
    NULL::uuid AS order_id,
    NULL::text AS order_num
  FROM public.listings AS l
  JOIN tip_totals AS tips
    ON tips.listing_id = l.id
   AND tips.seller_user_id = l.user_id
  WHERE l.status IN ('sold', 'removed')
    AND l.sold_off_platform = true
    AND NOT EXISTS (
      SELECT 1
      FROM checkout_lines AS checkout
      WHERE checkout.listing_id = l.id
    )
),
sold_lines AS (
  SELECT * FROM checkout_lines
  UNION ALL
  SELECT * FROM off_platform_lines
),
inventory_lines AS (
  SELECT
    l.user_id AS owner_id,
    'inventory:' || l.id::text AS entry_key,
    'inventory'::text AS sale_source,
    l.id AS listing_id,
    l.title AS listing_title,
    l.section AS listing_section,
    l.slug AS listing_slug,
    l.seller_purchase_price_usd AS purchase_price,
    l.seller_purchased_from AS purchased_from,
    l.seller_purchased_on AS purchased_on,
    l.price AS sold_price,
    0::numeric AS reswell_fee,
    0::numeric AS seller_proceeds,
    COALESCE(l.created_at, l.updated_at, now()) AS sold_at,
    NULL::uuid AS order_id,
    NULL::text AS order_num
  FROM public.listings AS l
  WHERE l.status IN ('active', 'pending')
    AND NOT EXISTS (
      SELECT 1
      FROM sold_lines AS sold
      WHERE sold.listing_id = l.id
    )
)
SELECT
  line.*,
  CASE
    WHEN line.sale_source = 'inventory' OR line.purchase_price IS NULL THEN NULL
    ELSE ROUND(line.seller_proceeds - line.purchase_price, 2)
  END AS profit,
  CASE
    WHEN line.sale_source = 'inventory'
      OR line.purchase_price IS NULL
      OR line.sold_price <= 0
    THEN NULL
    ELSE ROUND(
      ((line.seller_proceeds - line.purchase_price) / line.sold_price) * 100,
      2
    )
  END AS profit_margin_percent
FROM (
  SELECT * FROM sold_lines
  UNION ALL
  SELECT * FROM inventory_lines
) AS line;

COMMENT ON VIEW public.seller_balance_sheet_entries IS
  'Live seller inventory and sales derived from listings, non-refunded checkout lines, and tipped off-platform sales.';

GRANT SELECT ON public.seller_balance_sheet_entries TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_balance_sheet_summary()
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
  WHERE entry.owner_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_balance_sheet_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_balance_sheet_summary() TO authenticated;
