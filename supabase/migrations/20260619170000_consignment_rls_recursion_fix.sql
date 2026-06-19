-- Break infinite RLS recursion between consignment_stores ↔ consignment_store_staff.
--
-- Before this fix, policies on each table referenced the other with EXISTS subqueries under RLS,
-- which Postgres 15+ detects as infinite recursion (42P17). That broke *all* orders reads for
-- anyone on a store team — including /dashboard/purchases — because orders_select_store_team
-- touched consignment_stores during policy evaluation.
--
-- SECURITY DEFINER helpers read the underlying rows without re-entering RLS.

CREATE OR REPLACE FUNCTION public.is_consignment_store_owner(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consignment_stores
    WHERE id = p_store_id
      AND owner_profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_consignment_store_staff_member(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consignment_store_staff
    WHERE store_id = p_store_id
      AND profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_consignment_store(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_consignment_store_owner(p_store_id)
      OR public.is_consignment_store_staff_member(p_store_id);
$$;

REVOKE ALL ON FUNCTION public.is_consignment_store_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_consignment_store_staff_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_consignment_store(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_consignment_store_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_consignment_store_staff_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_consignment_store(uuid) TO authenticated;

-- Stores: public active rows + owner/staff access (no cross-table RLS subquery).
DROP POLICY IF EXISTS "consignment_stores_select_public" ON public.consignment_stores;
CREATE POLICY "consignment_stores_select_public" ON public.consignment_stores
  FOR SELECT
  USING (
    status = 'active'
    OR owner_profile_id = auth.uid()
    OR public.is_consignment_store_staff_member(id)
  );

-- Staff: self rows + owner sees their store roster.
DROP POLICY IF EXISTS "consignment_store_staff_select_self_or_owner" ON public.consignment_store_staff;
CREATE POLICY "consignment_store_staff_select_self_or_owner" ON public.consignment_store_staff
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR public.is_consignment_store_owner(store_id)
  );

-- Store customers: owner/staff only.
DROP POLICY IF EXISTS "store_customers_select_store_team" ON public.store_customers;
CREATE POLICY "store_customers_select_store_team" ON public.store_customers
  FOR SELECT
  USING (public.can_manage_consignment_store(store_id));

-- Intakes: consignor + store team.
DROP POLICY IF EXISTS "consignment_intakes_select_party" ON public.consignment_intakes;
CREATE POLICY "consignment_intakes_select_party" ON public.consignment_intakes
  FOR SELECT
  USING (
    consignor_profile_id = auth.uid()
    OR public.can_manage_consignment_store(store_id)
  );

-- Orders: store team reads consignment orders (POS + online attributed to the store).
DROP POLICY IF EXISTS "orders_select_store_team" ON public.orders;
CREATE POLICY "orders_select_store_team" ON public.orders
  FOR SELECT
  USING (
    consignment_store_id IS NOT NULL
    AND public.can_manage_consignment_store(consignment_store_id)
  );
