-- Admin wallet reset: delete PayPal payout audit rows for one user.
-- Uses SECURITY DEFINER so DELETE succeeds even when public.paypal_payouts has no DELETE RLS policy
-- for the PostgREST role (service-role REST should bypass RLS, but this matches server-side SQL patterns).

CREATE OR REPLACE FUNCTION public.admin_delete_paypal_payouts_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.paypal_payouts') IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.paypal_payouts WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_paypal_payouts_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_paypal_payouts_for_user(uuid) TO service_role;
