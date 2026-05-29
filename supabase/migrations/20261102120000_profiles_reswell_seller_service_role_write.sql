-- Fix: admin "Make Reswell Seller" writes were silently reverted.
--
-- The /api/admin/users/reswell-seller route authorizes the admin in app code,
-- then performs the UPDATE with the service-role client (auth.uid() IS NULL).
-- The existing guard trigger only allowed the change when auth.uid() mapped to
-- an admin profile, so service-role writes were reset to OLD via
-- `NEW.is_reswell_seller := OLD.is_reswell_seller`. The UPDATE returned success
-- but the value never persisted.
--
-- Allow the change for the service role (server-only, RLS-bypassing) in addition
-- to admin sessions. Regular authenticated/anon roles remain blocked.

CREATE OR REPLACE FUNCTION public.profiles_guard_reswell_seller_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_reswell_seller IS DISTINCT FROM OLD.is_reswell_seller THEN
    IF coalesce(auth.role(), '') <> 'service_role'
       AND NOT EXISTS (
         SELECT 1
         FROM public.profiles p
         WHERE p.id = auth.uid()
           AND p.is_admin IS TRUE
       )
    THEN
      NEW.is_reswell_seller := OLD.is_reswell_seller;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
