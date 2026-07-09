-- Retire public /surfers directory (app routes and CMS removed).
-- Empty/delete the `surfer-assets` storage bucket via the Storage API or dashboard
-- after this migration — direct DELETE on storage.objects / storage.buckets is blocked.

DROP POLICY IF EXISTS "surfers_select_public" ON public.surfers;
DROP POLICY IF EXISTS "surfers_insert_admin" ON public.surfers;
DROP POLICY IF EXISTS "surfers_update_admin" ON public.surfers;
DROP POLICY IF EXISTS "surfers_delete_admin" ON public.surfers;

DROP TABLE IF EXISTS public.surfers CASCADE;

DROP POLICY IF EXISTS "surfer_assets_select_public" ON storage.objects;
DROP POLICY IF EXISTS "surfer_assets_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "surfer_assets_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "surfer_assets_delete_admin" ON storage.objects;
