-- Someone added to a shop can run it, but cannot grow the team.
-- Earnings stay owner-only, same as the previous permission check.

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
    RETURN permission IS DISTINCT FROM 'payouts.read'
      AND permission IS DISTINCT FROM 'team.manage';
  END IF;
  RETURN false;
END;
$$;

COMMIT;
