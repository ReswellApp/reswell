-- Staff run the shop the same way managers do. Earnings and payout columns stay
-- with the owner. A member can edit the shop profile and its addresses, and
-- cannot change admin, payout, or restriction fields on that profile.

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

CREATE OR REPLACE FUNCTION public.profiles_freeze_shop_privileges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = NEW.id THEN
    RETURN NEW;
  END IF;
  IF NOT public.account_member_can(NEW.id, 'profile.manage') THEN
    RETURN NEW;
  END IF;

  NEW.is_admin := OLD.is_admin;
  NEW.is_employee := OLD.is_employee;
  NEW.active_shop_account_id := OLD.active_shop_account_id;
  NEW.paypal_email := OLD.paypal_email;
  NEW.paypal_payer_id := OLD.paypal_payer_id;
  NEW.paypal_display_name := OLD.paypal_display_name;
  NEW.paypal_connected_at := OLD.paypal_connected_at;
  NEW.account_restricted_until := OLD.account_restricted_until;
  NEW.account_restricted_reason := OLD.account_restricted_reason;
  NEW.message_rate_limited_until := OLD.message_rate_limited_until;
  NEW.is_reswell_seller := OLD.is_reswell_seller;
  NEW.seller_banned_at := OLD.seller_banned_at;
  NEW.seller_banned_reason := OLD.seller_banned_reason;
  NEW.shopify_connect_enabled := OLD.shopify_connect_enabled;
  NEW.shopify_manual_canary_enabled := OLD.shopify_manual_canary_enabled;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_freeze_shop_privileges ON public.profiles;
CREATE TRIGGER profiles_freeze_shop_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_freeze_shop_privileges();

DROP POLICY IF EXISTS profiles_update_shop_profile ON public.profiles;
CREATE POLICY profiles_update_shop_profile
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.account_member_can(id, 'profile.manage'))
  WITH CHECK (public.account_member_can(id, 'profile.manage'));

DROP POLICY IF EXISTS addresses_insert_shop_profile ON public.addresses;
CREATE POLICY addresses_insert_shop_profile
  ON public.addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.account_member_can(profile_id, 'profile.manage'));

DROP POLICY IF EXISTS addresses_update_shop_profile ON public.addresses;
CREATE POLICY addresses_update_shop_profile
  ON public.addresses
  FOR UPDATE
  TO authenticated
  USING (public.account_member_can(profile_id, 'profile.manage'))
  WITH CHECK (public.account_member_can(profile_id, 'profile.manage'));

DROP POLICY IF EXISTS addresses_delete_shop_profile ON public.addresses;
CREATE POLICY addresses_delete_shop_profile
  ON public.addresses
  FOR DELETE
  TO authenticated
  USING (public.account_member_can(profile_id, 'profile.manage'));

DROP POLICY IF EXISTS reviews_insert_shop_seller ON public.reviews;
CREATE POLICY reviews_insert_shop_seller
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = public.acting_shop_account_id()
    AND reviewer_id IS DISTINCT FROM auth.uid()
    AND public.account_member_can(reviewer_id, 'orders.write')
    AND order_id IS NOT NULL
    AND listing_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.seller_id = reviewer_id
        AND o.buyer_id = reviewed_id
        AND o.listing_id = listing_id
        AND o.status = 'confirmed'
        AND (
          o.delivery_status = 'delivered'
          OR o.delivery_status = 'picked_up'
        )
    )
  );

DROP POLICY IF EXISTS listings_storage_insert_shop ON storage.objects;
CREATE POLICY listings_storage_insert_shop
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.account_member_can(((storage.foldername(name))[1])::uuid, 'listings.write')
  );

DROP POLICY IF EXISTS listings_storage_update_shop ON storage.objects;
CREATE POLICY listings_storage_update_shop
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.account_member_can(((storage.foldername(name))[1])::uuid, 'listings.write')
  )
  WITH CHECK (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.account_member_can(((storage.foldername(name))[1])::uuid, 'listings.write')
  );

DROP POLICY IF EXISTS listings_storage_delete_shop ON storage.objects;
CREATE POLICY listings_storage_delete_shop
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'listings'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.account_member_can(((storage.foldername(name))[1])::uuid, 'listings.write')
  );

COMMIT;
