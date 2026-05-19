-- Keep is_reswell_seller server-side only: not readable or writable via the public Supabase API roles.

REVOKE SELECT (is_reswell_seller) ON public.profiles FROM authenticated, anon;
REVOKE UPDATE (is_reswell_seller) ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.profiles_guard_reswell_seller_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_reswell_seller IS DISTINCT FROM OLD.is_reswell_seller THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin IS TRUE
    ) THEN
      NEW.is_reswell_seller := OLD.is_reswell_seller;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_reswell_seller ON public.profiles;
CREATE TRIGGER profiles_guard_reswell_seller
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_reswell_seller_privilege();
