-- Team members working inside a shop need the shop's ship-from address and
-- spendable balance to buy and print labels. They still cannot edit those
-- rows or cash out. Payout pages stay behind payouts.read in the app.

BEGIN;

DROP POLICY IF EXISTS addresses_select_shop_orders ON public.addresses;
CREATE POLICY addresses_select_shop_orders
  ON public.addresses
  FOR SELECT
  TO authenticated
  USING (public.account_member_can(profile_id, 'orders.read'));

DROP POLICY IF EXISTS wallets_select_shop_orders ON public.wallets;
CREATE POLICY wallets_select_shop_orders
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (public.account_member_can(user_id, 'orders.read'));

COMMIT;
