-- 1) Make haydensbsb@gmail.com the marketplace admin
--    (Run in Supabase SQL Editor. Uses auth.users so it works even if profiles.email is not set.)
UPDATE public.profiles
SET is_admin = true, updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'haydensbsb@gmail.com');

-- 2) Admin RLS: allow admins to create listings on behalf of any user
DROP POLICY IF EXISTS "listings_insert_admin" ON public.listings;
CREATE POLICY "listings_insert_admin" ON public.listings
  FOR INSERT
  WITH CHECK ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

-- 3) Admin RLS: allow admins to manage all listings (update status, delete)
DROP POLICY IF EXISTS "listings_update_admin" ON public.listings;
CREATE POLICY "listings_update_admin" ON public.listings
  FOR UPDATE
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

DROP POLICY IF EXISTS "listings_delete_admin" ON public.listings;
CREATE POLICY "listings_delete_admin" ON public.listings
  FOR DELETE
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

-- 4) Admin RLS: allow admins to update any profile (e.g. grant/revoke admin)
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

-- 5) Reports: allow admins to select and update all reports
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE
  USING ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

-- 6) Admin can add listing images when creating listings on behalf of users
DROP POLICY IF EXISTS "listing_images_insert_admin" ON public.listing_images;
CREATE POLICY "listing_images_insert_admin" ON public.listing_images
  FOR INSERT
  WITH CHECK ((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()) = true);

-- 7) Admin can select all profiles (for users list)
--    (profiles already has profiles_select_public FOR SELECT USING (true), so no change needed.)
