-- Shop account membership.
-- Any seller can invite other emails onto their account with manager or staff
-- access. Signing in with an invited email does not copy profiles.is_admin or
-- profiles.is_employee from the shop, so a member of the platform-admin shop
-- still cannot open /admin unless that grant exists on their own profile.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_shop_account_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_shop_account_id IS
  'Shop account this login is currently operating. Null means their own account. Never grants platform admin.';

CREATE TABLE IF NOT EXISTS public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  email text NOT NULL,
  member_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  role text NOT NULL,
  status text NOT NULL,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT account_members_email_normalized CHECK (email = lower(email) AND position('@' IN email) > 1),
  CONSTRAINT account_members_role_check CHECK (role IN ('manager', 'staff')),
  CONSTRAINT account_members_status_check CHECK (status IN ('invited', 'active', 'revoked')),
  CONSTRAINT account_members_not_owner CHECK (member_user_id IS NULL OR member_user_id <> account_id)
);

COMMENT ON TABLE public.account_members IS
  'Additional login emails for a seller account. Access is the row role, not the shop owner''s platform flags.';

CREATE UNIQUE INDEX IF NOT EXISTS account_members_live_email_idx
  ON public.account_members (account_id, email)
  WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS account_members_member_user_idx
  ON public.account_members (member_user_id)
  WHERE member_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS account_members_email_idx
  ON public.account_members (email);

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.account_member_role(target_account uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN target_account IS NULL OR auth.uid() IS NULL THEN NULL
    WHEN target_account = auth.uid() THEN 'owner'
    ELSE (
      SELECT m.role
      FROM public.account_members m
      WHERE m.account_id = target_account
        AND m.member_user_id = auth.uid()
        AND m.status = 'active'
      LIMIT 1
    )
  END;
$$;

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
  IF member_role = 'manager' THEN
    RETURN permission IS DISTINCT FROM 'payouts.read';
  END IF;
  IF member_role = 'staff' THEN
    RETURN permission IN (
      'listings.read',
      'listings.write',
      'orders.read',
      'orders.write',
      'offers.read',
      'offers.write',
      'messages.read',
      'messages.write'
    );
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.acting_shop_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.active_shop_account_id IS NOT NULL
      AND public.account_member_role(p.active_shop_account_id) IS NOT NULL
    THEN p.active_shop_account_id
    ELSE p.id
  END
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.account_member_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.account_member_can(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acting_shop_account_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_member_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_member_can(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acting_shop_account_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.profiles_guard_active_shop_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.active_shop_account_id IS NOT DISTINCT FROM OLD.active_shop_account_id THEN
    RETURN NEW;
  END IF;
  IF NEW.active_shop_account_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.account_member_role(NEW.active_shop_account_id) IS NULL THEN
    RAISE EXCEPTION 'not a member of that account';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_active_shop_account ON public.profiles;
CREATE TRIGGER profiles_guard_active_shop_account
  BEFORE UPDATE OF active_shop_account_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_active_shop_account();

DROP POLICY IF EXISTS account_members_select ON public.account_members;
CREATE POLICY account_members_select
  ON public.account_members
  FOR SELECT
  TO authenticated
  USING (
    member_user_id = auth.uid()
    OR public.account_member_can(account_id, 'team.read')
    OR (
      status = 'invited'
      AND email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

GRANT SELECT ON TABLE public.account_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_members TO service_role;

-- New listings created while working inside a shop belong to that shop.
CREATE OR REPLACE FUNCTION public.listings_assign_acting_shop_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_id uuid;
BEGIN
  shop_id := public.acting_shop_account_id();
  IF shop_id IS NOT NULL
     AND shop_id IS DISTINCT FROM auth.uid()
     AND NEW.user_id IS NOT DISTINCT FROM auth.uid()
     AND public.account_member_can(shop_id, 'listings.write')
  THEN
    NEW.user_id := shop_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_assign_acting_shop_owner ON public.listings;
CREATE TRIGGER listings_assign_acting_shop_owner
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_assign_acting_shop_owner();

DROP POLICY IF EXISTS listings_account_member_write ON public.listings;
CREATE POLICY listings_account_member_write
  ON public.listings
  FOR ALL
  TO authenticated
  USING (public.account_member_can(user_id, 'listings.write'))
  WITH CHECK (public.account_member_can(user_id, 'listings.write'));

DROP POLICY IF EXISTS "listings_select_public" ON public.listings;
CREATE POLICY "listings_select_public" ON public.listings
  FOR SELECT
  USING (
    status IS DISTINCT FROM 'draft'
    OR user_id = (SELECT auth.uid())
    OR public.account_member_can(user_id, 'listings.read')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
    )
  );

DROP POLICY IF EXISTS listing_images_account_member_write ON public.listing_images;
CREATE POLICY listing_images_account_member_write
  ON public.listing_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND public.account_member_can(l.user_id, 'listings.write')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND public.account_member_can(l.user_id, 'listings.write')
    )
  );

DROP POLICY IF EXISTS "listing_images_select_public" ON public.listing_images;
CREATE POLICY "listing_images_select_public" ON public.listing_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id
        AND (
          l.status IS DISTINCT FROM 'draft'
          OR l.user_id = (SELECT auth.uid())
          OR public.account_member_can(l.user_id, 'listings.read')
          OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
          )
        )
    )
  );

DROP POLICY IF EXISTS listing_videos_account_member_write ON public.listing_videos;
CREATE POLICY listing_videos_account_member_write
  ON public.listing_videos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND public.account_member_can(l.user_id, 'listings.write')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND public.account_member_can(l.user_id, 'listings.write')
    )
  );

DROP POLICY IF EXISTS orders_select_account_member ON public.orders;
CREATE POLICY orders_select_account_member
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.account_member_can(seller_id, 'orders.read'));

DROP POLICY IF EXISTS orders_update_account_member ON public.orders;
CREATE POLICY orders_update_account_member
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.account_member_can(seller_id, 'orders.write'))
  WITH CHECK (public.account_member_can(seller_id, 'orders.write'));

DROP POLICY IF EXISTS offers_select_account_member ON public.offers;
CREATE POLICY offers_select_account_member
  ON public.offers
  FOR SELECT
  TO authenticated
  USING (public.account_member_can(seller_id, 'offers.read'));

DROP POLICY IF EXISTS offers_update_account_member ON public.offers;
CREATE POLICY offers_update_account_member
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (public.account_member_can(seller_id, 'offers.write'))
  WITH CHECK (public.account_member_can(seller_id, 'offers.write'));

CREATE OR REPLACE FUNCTION public.user_is_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conv_id
      AND (
        c.buyer_id = auth.uid()
        OR c.seller_id = auth.uid()
        OR public.account_member_can(c.seller_id, 'messages.read')
      )
  );
$$;

DROP POLICY IF EXISTS messages_insert_account_member ON public.messages;
CREATE POLICY messages_insert_account_member
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_conversation_participant(conversation_id)
    AND (
      sender_id = auth.uid()
      OR (
        sender_id = public.acting_shop_account_id()
        AND public.account_member_can(sender_id, 'messages.write')
      )
    )
  );

-- Seller dashboard aggregates follow the shop the login is operating.
CREATE OR REPLACE FUNCTION public.get_my_listings_engagement_counts()
RETURNS TABLE (
  listing_id uuid,
  cart_count bigint,
  favorite_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS listing_id,
    coalesce(cart_counts.cnt, 0)::bigint AS cart_count,
    coalesce(fav_counts.cnt, 0)::bigint AS favorite_count
  FROM public.listings l
  LEFT JOIN (
    SELECT ci.listing_id, count(*) AS cnt
    FROM public.cart_items ci
    INNER JOIN public.listings cl ON cl.id = ci.listing_id
    WHERE coalesce(cl.hidden_from_site, false) = false
      AND cl.section IN (
        'surfboards',
        'fins',
        'wetsuits',
        'boardbags',
        'surfpacks',
        'leashes',
        'apparel',
        'accessories',
        'magazines'
      )
      AND cl.archived_at IS NULL
      AND cl.status IN ('active', 'pending_sale')
      AND (
        cl.local_pickup IS DISTINCT FROM false
        OR coalesce(cl.shipping_available, false) = true
      )
    GROUP BY ci.listing_id
  ) cart_counts ON cart_counts.listing_id = l.id
  LEFT JOIN (
    SELECT f.listing_id, count(*) AS cnt
    FROM public.favorites f
    GROUP BY f.listing_id
  ) fav_counts ON fav_counts.listing_id = l.id
  WHERE l.user_id = public.acting_shop_account_id()
    AND l.archived_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_my_listings_dashboard_stats()
RETURNS TABLE (
  total_listings bigint,
  total_views bigint,
  in_carts bigint,
  saved bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT l.id, l.views
    FROM public.listings l
    WHERE l.user_id = public.acting_shop_account_id()
      AND l.archived_at IS NULL
  )
  SELECT
    (SELECT count(*)::bigint FROM mine) AS total_listings,
    (SELECT coalesce(sum(views), 0)::bigint FROM mine) AS total_views,
    (
      SELECT count(*)::bigint
      FROM public.cart_items ci
      INNER JOIN public.listings l ON l.id = ci.listing_id
      WHERE l.user_id = public.acting_shop_account_id()
        AND l.archived_at IS NULL
        AND coalesce(l.hidden_from_site, false) = false
        AND l.section IN (
          'surfboards',
          'fins',
          'wetsuits',
          'boardbags',
          'surfpacks',
          'leashes',
          'apparel',
          'accessories',
          'magazines'
        )
        AND l.status IN ('active', 'pending_sale')
        AND (
          l.local_pickup IS DISTINCT FROM false
          OR coalesce(l.shipping_available, false) = true
        )
    ) AS in_carts,
    (
      SELECT count(*)::bigint
      FROM public.favorites f
      INNER JOIN public.listings l ON l.id = f.listing_id
      WHERE l.user_id = public.acting_shop_account_id()
        AND l.archived_at IS NULL
    ) AS saved;
$$;

CREATE OR REPLACE FUNCTION public.get_my_seller_earnings_totals()
RETURNS TABLE (
  lifetime_sold_usd numeric,
  earned_last_30d_usd numeric,
  earned_last_90d_usd numeric,
  earned_last_365d_usd numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NOT public.account_member_can(public.acting_shop_account_id(), 'payouts.read') THEN 0
      ELSE COALESCE(ROUND((
        SELECT SUM(o.seller_earnings::numeric)
        FROM public.orders o
        WHERE o.seller_id = public.acting_shop_account_id()
          AND o.is_admin_test = false
          AND o.status IS DISTINCT FROM 'refunded'
      ), 2), 0)
    END::numeric AS lifetime_sold_usd,
    CASE
      WHEN NOT public.account_member_can(public.acting_shop_account_id(), 'payouts.read') THEN 0
      ELSE COALESCE(ROUND((
        SELECT SUM(o.seller_earnings::numeric)
        FROM public.orders o
        WHERE o.seller_id = public.acting_shop_account_id()
          AND o.is_admin_test = false
          AND o.status IS DISTINCT FROM 'refunded'
          AND o.created_at >= now() - interval '30 days'
      ), 2), 0)
    END::numeric AS earned_last_30d_usd,
    CASE
      WHEN NOT public.account_member_can(public.acting_shop_account_id(), 'payouts.read') THEN 0
      ELSE COALESCE(ROUND((
        SELECT SUM(o.seller_earnings::numeric)
        FROM public.orders o
        WHERE o.seller_id = public.acting_shop_account_id()
          AND o.is_admin_test = false
          AND o.status IS DISTINCT FROM 'refunded'
          AND o.created_at >= now() - interval '90 days'
      ), 2), 0)
    END::numeric AS earned_last_90d_usd,
    CASE
      WHEN NOT public.account_member_can(public.acting_shop_account_id(), 'payouts.read') THEN 0
      ELSE COALESCE(ROUND((
        SELECT SUM(o.seller_earnings::numeric)
        FROM public.orders o
        WHERE o.seller_id = public.acting_shop_account_id()
          AND o.is_admin_test = false
          AND o.status IS DISTINCT FROM 'refunded'
          AND o.created_at >= now() - interval '365 days'
      ), 2), 0)
    END::numeric AS earned_last_365d_usd;
$$;

COMMIT;
