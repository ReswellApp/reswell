-- Someone added to a shop can run it, but cannot grow the team.
-- Earnings stay owner-only. One SQL statement, no inner semicolons, so the
-- Supabase SQL editor does not split the function body apart.

CREATE OR REPLACE FUNCTION public.account_member_can(target_account uuid, permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN role_name IS NULL THEN false
    WHEN role_name = 'owner' THEN true
    WHEN role_name IN ('manager', 'staff') THEN
      permission IS DISTINCT FROM 'payouts.read'
      AND permission IS DISTINCT FROM 'team.manage'
    ELSE false
  END
  FROM (
    SELECT public.account_member_role(target_account) AS role_name
  ) AS shop_role
$fn$
