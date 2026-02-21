-- Add is_employee to profiles (limited admin: listings + reports, no user management)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_employee BOOLEAN DEFAULT FALSE;

-- Listings: allow employees to manage (update/delete) as well as admins
DROP POLICY IF EXISTS "listings_update_admin" ON public.listings;
CREATE POLICY "listings_update_admin" ON public.listings
  FOR UPDATE
  USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "listings_delete_admin" ON public.listings;
CREATE POLICY "listings_delete_admin" ON public.listings
  FOR DELETE
  USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

-- Listings insert: keep admin-only (employees cannot create on behalf of users)
-- (existing listings_insert_admin is unchanged)

-- Reports: allow employees to select and update as well as admins
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT
  USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE
  USING (
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
    OR (SELECT p.is_employee FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

-- profiles_update_admin stays admin-only (only full admins can grant/revoke admin or employee)
