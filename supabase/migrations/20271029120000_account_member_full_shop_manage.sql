-- Staff run the shop the same way managers do, except earnings and payouts.
-- This only replaces the permission check that listings, orders, offers,
-- messages, and earnings already use. Shop profile and address edits go
-- through server actions, which write the specific fields after this check.
-- There is no browser policy that lets a teammate update another profile.

BEGIN;

CREATE OR REPLACE FUNCTION public.account_member_can(target_account uuid, permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_role text;
BEGIN
  member_role := public.account_member_role(target_account);
  IF member_role IS NULL THEN
    RETURN false;
  END IF;
  IF member_role = 'owner' THEN
    RETURN true;
  END IF;
  IF member_role = 'manager' OR member_role = 'staff' THEN
    RETURN permission IS DISTINCT FROM 'payouts.read';
  END IF;
  RETURN false;
END;
$$;

COMMIT;
