-- Consolidate marketplace transactions: `purchases` → `orders`.
-- Remove legacy new-gear shop: drop `order_items` and cart `orders` (section=new checkout).
-- After this migration, `public.orders` is the peer-to-peer order table (buyer/seller/listing).

-- ─────────────────────────────────────────────────────────────
-- 1. Drop shop-only tables (cart line items first)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.order_items CASCADE;

DROP TABLE IF EXISTS public.orders CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 2. Rename marketplace purchases → orders
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.purchases RENAME TO orders;

ALTER TABLE public.orders
  RENAME CONSTRAINT purchases_fulfillment_method_check TO orders_fulfillment_method_check;

COMMENT ON TABLE public.orders IS
  'Marketplace order: one transaction between buyer and seller for a listing.';

-- ─────────────────────────────────────────────────────────────
-- 3. RLS policies on orders (rename from purchases_*)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchases_select_as_buyer" ON public.orders;
DROP POLICY IF EXISTS "purchases_select_as_seller" ON public.orders;

CREATE POLICY "orders_select_as_buyer" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "orders_select_as_seller" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

-- Wallet checkout (Reswell Bucks) inserts a row as the buyer
DROP POLICY IF EXISTS "orders_insert_as_buyer" ON public.orders;
CREATE POLICY "orders_insert_as_buyer" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4. Reviews: policy referenced public.purchases — update to orders
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;

CREATE POLICY "reviews_insert_own"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.buyer_id = auth.uid()
      AND o.seller_id = reviewed_id
      AND o.status = 'confirmed'
  )
);

-- ─────────────────────────────────────────────────────────────
-- 5. Purchase protection eligibility: join target is now orders
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pe_buyer_read" ON public.protection_eligibility;

CREATE POLICY "pe_buyer_read" ON public.protection_eligibility
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = protection_eligibility.order_id
        AND o.buyer_id = auth.uid()
    )
  );
