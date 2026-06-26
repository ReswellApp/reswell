-- Roll back consignment store / POS schema. Peer marketplace checkout is unchanged.

DELETE FROM public.wallet_transactions
WHERE reference_type IN (
  'consignment_order_pending_consignor',
  'consignment_order_pending_shop',
  'consignment_order_consignor_earnings',
  'consignment_order_shop_commission'
);

-- Remove consignment-only orders before tightening buyer_id and dropping columns.
DELETE FROM public.orders
WHERE sales_channel IN ('pos', 'off_platform')
   OR consignment_store_id IS NOT NULL;

DROP INDEX IF EXISTS wallet_tx_consignment_refund_uidx;

-- Policies reference consignment helper functions — drop them before the functions.
DROP POLICY IF EXISTS "orders_select_store_team" ON public.orders;
DROP POLICY IF EXISTS "consignment_intakes_select_party" ON public.consignment_intakes;
DROP POLICY IF EXISTS "store_customers_select_store_team" ON public.store_customers;
DROP POLICY IF EXISTS "consignment_store_staff_select_self_or_owner" ON public.consignment_store_staff;
DROP POLICY IF EXISTS "consignment_stores_select_public" ON public.consignment_stores;

DROP FUNCTION IF EXISTS public.consignment_store_sales_summary(uuid);
DROP FUNCTION IF EXISTS public.refund_consignment_order(uuid);
DROP FUNCTION IF EXISTS public.release_consignment_order_earnings(uuid);
DROP FUNCTION IF EXISTS public.can_manage_consignment_store(uuid);
DROP FUNCTION IF EXISTS public.is_consignment_store_staff_member(uuid);
DROP FUNCTION IF EXISTS public.is_consignment_store_owner(uuid);

DROP TRIGGER IF EXISTS profiles_guard_consignment_shop ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_guard_consignment_shop_privilege();

DROP TABLE IF EXISTS public.consignment_intakes;
DROP TABLE IF EXISTS public.store_customers;
DROP TABLE IF EXISTS public.consignment_store_staff;
DROP TABLE IF EXISTS public.consignment_stores;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_intake_status_check,
  DROP CONSTRAINT IF EXISTS listings_commission_bps_check;

DROP INDEX IF EXISTS public.listings_consignment_store_idx;
DROP INDEX IF EXISTS public.listings_consignor_idx;
DROP INDEX IF EXISTS public.listings_barcode_idx;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS consignment_store_id,
  DROP COLUMN IF EXISTS consignor_profile_id,
  DROP COLUMN IF EXISTS intake_status,
  DROP COLUMN IF EXISTS consignor_proposed_price,
  DROP COLUMN IF EXISTS floor_price,
  DROP COLUMN IF EXISTS commission_bps,
  DROP COLUMN IF EXISTS shop_sku,
  DROP COLUMN IF EXISTS barcode;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_sales_channel_check,
  DROP CONSTRAINT IF EXISTS orders_buyer_required_unless_pos;

DROP INDEX IF EXISTS public.orders_consignment_store_idx;
DROP INDEX IF EXISTS public.orders_consignor_idx;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS sales_channel,
  DROP COLUMN IF EXISTS consignment_store_id,
  DROP COLUMN IF EXISTS consignor_profile_id,
  DROP COLUMN IF EXISTS shop_commission_gross,
  DROP COLUMN IF EXISTS shop_net_earnings,
  DROP COLUMN IF EXISTS consignor_earnings,
  DROP COLUMN IF EXISTS store_customer_id,
  DROP COLUMN IF EXISTS pos_staff_profile_id;

ALTER TABLE public.orders
  ALTER COLUMN buyer_id SET NOT NULL;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_consignment_shop;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_reference_type_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions
      DROP CONSTRAINT wallet_transactions_reference_type_check;
  END IF;

  ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_reference_type_check
    CHECK (
      reference_type IS NULL
      OR reference_type IN (
        'listing',
        'order_pending_earnings',
        'order_seller_earnings',
        'stripe_refund',
        'wallet_refund',
        'stripe_connect_transfer',
        'paypal_payout',
        'shipping_fee_correction',
        'seller_shipping_label',
        'seller_flat_shipping_surplus'
      )
    );
END $$;

-- Restore recently-sold RPCs without POS / sales_channel filtering.
DROP FUNCTION IF EXISTS public.recently_sold_surfboard_listing_sale_times(integer);
DROP FUNCTION IF EXISTS public.recently_sold_listing_sale_times(integer, text[]);

CREATE FUNCTION public.recently_sold_listing_sale_times(
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
    AND (l.hidden_from_site = false OR l.archived_at IS NOT NULL)
  ORDER BY pl.sale_confirmed_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 120);
$function$;

COMMENT ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) IS
  'Peer listing ids ordered by newest confirmed-order time; excludes admin test orders and admin hide-from-site without seller archive.';

REVOKE ALL ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recently_sold_listing_sale_times(integer, text[]) TO service_role;

CREATE FUNCTION public.recently_sold_surfboard_listing_sale_times(p_limit integer)
RETURNS TABLE(listing_id uuid, sale_confirmed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT *
  FROM public.recently_sold_listing_sale_times(p_limit, ARRAY['surfboards']::text[]);
$function$;

COMMENT ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) IS
  'Surfboard listing ids ordered by newest confirmed-order time; wrapper around recently_sold_listing_sale_times.';

REVOKE ALL ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recently_sold_surfboard_listing_sale_times(integer) TO service_role;
