-- ─────────────────────────────────────────────────────────────────────────────
-- POS sales: in-store buyers are walk-ins captured as `store_customers`, not Reswell
-- auth users. Relax orders.buyer_id so a POS order can settle without an account, while a
-- CHECK keeps every online order anchored to an authenticated buyer (the prior invariant).
-- Additive + idempotent: re-runnable, and online checkout is entirely unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;

COMMENT ON COLUMN public.orders.buyer_id IS
  'Buyer auth user id. Required for online orders; NULL for in-store POS walk-ins (see store_customer_id).';

-- Online (and externally recorded) orders must still carry an authenticated buyer.
-- Only POS orders may omit buyer_id; they identify the buyer via store_customer_id when captured.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_required_unless_pos'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_buyer_required_unless_pos
      CHECK (buyer_id IS NOT NULL OR sales_channel = 'pos');
  END IF;
END $$;

-- Store staff (owner + roster) can read their store's orders for the POS / shop dashboards.
-- Buyers and sellers keep their existing access through prior policies; this only widens reads
-- to consignment store team members for orders attributed to their store.
DROP POLICY IF EXISTS "orders_select_store_team" ON public.orders;
CREATE POLICY "orders_select_store_team" ON public.orders
  FOR SELECT
  USING (
    consignment_store_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.consignment_stores st
        WHERE st.id = orders.consignment_store_id AND st.owner_profile_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.consignment_store_staff s
        WHERE s.store_id = orders.consignment_store_id AND s.profile_id = auth.uid()
      )
    )
  );
