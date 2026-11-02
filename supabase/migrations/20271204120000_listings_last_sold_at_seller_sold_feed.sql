-- Scale seller shop Sold: denormalize sale time onto listings so Sold tabs
-- are indexed listings reads instead of rebuilding checkout history.
--
-- Replaces public.seller_profile_sold_listing_ids (from
-- 20271203120000_seller_profile_sold_include_quantity_sales.sql).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS last_sold_at timestamptz;

COMMENT ON COLUMN public.listings.last_sold_at IS
  'Most recent confirmed sale time for this listing. Set on checkout stock decrement, unique-item checkout sold, and mark-as-sold. Cleared on off-platform relist.';

CREATE INDEX IF NOT EXISTS listings_user_id_last_sold_at_idx
  ON public.listings (user_id, last_sold_at DESC NULLS LAST)
  WHERE last_sold_at IS NOT NULL;

-- Quantity sales: stamp last_sold_at on every unit sale, including while stock remains.
CREATE OR REPLACE FUNCTION public.decrement_listing_stock(
  p_listing_id uuid,
  p_qty integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'decrement_listing_stock: qty must be >= 1';
  END IF;

  UPDATE public.listings
  SET
    stock_quantity = stock_quantity - p_qty,
    status = CASE
      WHEN stock_quantity - p_qty <= 0 THEN 'sold'
      ELSE status
    END,
    last_sold_at = now(),
    updated_at = now()
  WHERE id = p_listing_id
    AND stock_quantity >= p_qty
    AND coalesce(inventory_source, 'reswell') IS DISTINCT FROM 'shopify'
    AND (
      section = 'new'
      OR condition IN ('brand_new', 'new')
    )
  RETURNING stock_quantity INTO v_remaining;

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'decrement_listing_stock: insufficient stock for listing %', p_listing_id;
  END IF;

  RETURN v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_listing_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_listing_stock(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.decrement_listing_stock(uuid, integer) IS
  'Atomically decrements Reswell shop stock or brand-new peer stock. Stamps last_sold_at. Marks sold when remaining hits 0. Service role only.';

-- Backfill last_sold_at from confirmed checkouts, tips, and sold rows.
WITH sale_times AS (
  SELECT
    oi.listing_id AS lid,
    MAX(o.created_at) AS sold_at
  FROM public.orders o
  INNER JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.status = 'confirmed'
    AND o.is_admin_test = false
  GROUP BY oi.listing_id

  UNION ALL

  SELECT
    o.listing_id,
    MAX(o.created_at)
  FROM public.orders o
  WHERE o.status = 'confirmed'
    AND o.is_admin_test = false
    AND o.listing_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    )
  GROUP BY o.listing_id

  UNION ALL

  SELECT
    sst.listing_id,
    MAX(COALESCE(sst.succeeded_at, sst.created_at))
  FROM public.seller_sale_tips sst
  WHERE sst.status = 'succeeded'
  GROUP BY sst.listing_id

  UNION ALL

  SELECT
    l.id,
    COALESCE(l.sold_off_platform_at, l.updated_at, l.created_at)
  FROM public.listings l
  WHERE l.status = 'sold'
),
best AS (
  SELECT lid, MAX(sold_at) AS sold_at
  FROM sale_times
  WHERE lid IS NOT NULL
    AND sold_at IS NOT NULL
  GROUP BY lid
)
UPDATE public.listings l
SET last_sold_at = b.sold_at
FROM best b
WHERE l.id = b.lid
  AND (l.last_sold_at IS NULL OR l.last_sold_at < b.sold_at);

-- App code no longer calls this; drop the interim order-rebuild RPC.
DROP FUNCTION IF EXISTS public.seller_profile_sold_listing_ids(uuid, text[], integer);
