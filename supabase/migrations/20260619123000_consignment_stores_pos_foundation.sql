-- Consignment stores + POS foundation (Phase 1a).
--
-- Reswell becomes the rails for used-board consignment shops. Each shop is a tenant; consignors
-- list boards through a shop; on sale the item price splits three ways:
--   * consignor  = item_price − shop_commission_gross
--   * shop net    = shop_commission_gross − reswell_fee
--   * Reswell     = reswell_fee (7% of item price, paid out of the shop's commission)
--
-- This migration is PURELY ADDITIVE. It introduces new tables and nullable columns and a new
-- settlement RPC; it does not alter or drop any existing peer-marketplace behavior. Listings and
-- orders without `consignment_store_id` continue through the existing single-seller path untouched.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Consignment stores (tenants). Reswell flagship is store #1; partners onboard later.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,

  -- Commission the shop takes on the item price (basis points). Must cover the Reswell fee.
  default_commission_bps integer NOT NULL DEFAULT 2500
    CHECK (default_commission_bps >= 700 AND default_commission_bps <= 9000),
  -- Platform fee taken out of the shop's commission (basis points). Default 7%.
  reswell_fee_bps integer NOT NULL DEFAULT 700
    CHECK (reswell_fee_bps >= 0 AND reswell_fee_bps <= 5000),

  -- Stripe Terminal location for in-store card-present POS (set when POS is provisioned).
  stripe_terminal_location_id text,
  -- Signed token embedded in the store's consignment-intake QR code.
  intake_qr_token text UNIQUE,

  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT consignment_stores_slug_nonempty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT consignment_stores_name_nonempty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE public.consignment_stores IS
  'A consignment board shop (tenant) on Reswell. Reswell flagship is the first row; partner shops onboard the same way.';
COMMENT ON COLUMN public.consignment_stores.default_commission_bps IS
  'Shop commission on item price in basis points (e.g. 2500 = 25%). Must be >= reswell_fee_bps so shop net never goes negative.';
COMMENT ON COLUMN public.consignment_stores.reswell_fee_bps IS
  'Reswell platform fee in basis points, taken out of the shop commission (default 700 = 7%).';

CREATE INDEX IF NOT EXISTS consignment_stores_owner_idx
  ON public.consignment_stores (owner_profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Store staff (POS operators, intake approvers, shop messaging).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_store_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.consignment_stores (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'clerk' CHECK (role IN ('owner', 'manager', 'clerk')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consignment_store_staff_unique UNIQUE (store_id, profile_id)
);

COMMENT ON TABLE public.consignment_store_staff IS
  'People who can operate a store: run POS, approve intakes, and handle listing messaging. Distinct from Reswell-internal is_employee.';

CREATE INDEX IF NOT EXISTS consignment_store_staff_profile_idx
  ON public.consignment_store_staff (profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Store customers (POS walk-ins captured to the shop's customer list).
--    Online buyers always have buyer_id; POS buyers are captured here (name/email/phone).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.consignment_stores (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  email text NOT NULL,
  phone_e164 text,
  -- Linked if the customer later creates / signs in to a Reswell account with this email.
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_customers_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT store_customers_store_email_unique UNIQUE (store_id, email)
);

COMMENT ON TABLE public.store_customers IS
  'Per-store customer record captured at POS (first/last name, email, phone). Deduped by email per store.';

CREATE INDEX IF NOT EXISTS store_customers_store_idx ON public.store_customers (store_id);
CREATE INDEX IF NOT EXISTS store_customers_profile_idx ON public.store_customers (profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Consignment intake audit (QR drop-off → shop approval → live listing).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.consignment_stores (id) ON DELETE CASCADE,
  consignor_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  consignor_proposed_price numeric(12, 2) CHECK (consignor_proposed_price IS NULL OR consignor_proposed_price >= 0),
  floor_price numeric(12, 2) CHECK (floor_price IS NULL OR floor_price >= 0),
  commission_bps integer CHECK (commission_bps IS NULL OR (commission_bps >= 700 AND commission_bps <= 9000)),
  terms_accepted_at timestamptz,
  approved_by_staff_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'active', 'rejected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.consignment_intakes IS
  'Audit trail of a consignor handing a board to a shop: proposed/floor price, agreed commission, approval.';

CREATE INDEX IF NOT EXISTS consignment_intakes_store_idx ON public.consignment_intakes (store_id);
CREATE INDEX IF NOT EXISTS consignment_intakes_consignor_idx ON public.consignment_intakes (consignor_profile_id);
CREATE INDEX IF NOT EXISTS consignment_intakes_listing_idx ON public.consignment_intakes (listing_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Listings: consignment attribution. NULL consignment_store_id = ordinary peer listing.
--    The shop is the seller of record (listings.user_id); consignor_profile_id is paid on sale.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS consignment_store_id uuid REFERENCES public.consignment_stores (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consignor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intake_status text,
  ADD COLUMN IF NOT EXISTS consignor_proposed_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS floor_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS commission_bps integer,
  ADD COLUMN IF NOT EXISTS shop_sku text,
  ADD COLUMN IF NOT EXISTS barcode text;

COMMENT ON COLUMN public.listings.consignment_store_id IS
  'When set, this listing is consigned through a store; the store is the seller of record and handles messaging/fulfillment.';
COMMENT ON COLUMN public.listings.consignor_profile_id IS
  'Owner of a consigned board (paid consignor_earnings on sale). NULL for ordinary peer listings.';
COMMENT ON COLUMN public.listings.floor_price IS
  'Lowest price the shop may sell at without consignor approval. Sales below this are blocked in software.';
COMMENT ON COLUMN public.listings.commission_bps IS
  'Per-listing shop commission override in basis points; NULL falls back to consignment_stores.default_commission_bps.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_intake_status_check'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_intake_status_check
      CHECK (intake_status IS NULL OR intake_status IN ('pending_approval', 'active', 'rejected', 'withdrawn'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_commission_bps_check'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_commission_bps_check
      CHECK (commission_bps IS NULL OR (commission_bps >= 700 AND commission_bps <= 9000));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listings_consignment_store_idx
  ON public.listings (consignment_store_id) WHERE consignment_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS listings_consignor_idx
  ON public.listings (consignor_profile_id) WHERE consignor_profile_id IS NOT NULL;
-- Barcode/SKU lookups are scoped per shop at the app layer; index for fast POS scans.
CREATE INDEX IF NOT EXISTS listings_barcode_idx
  ON public.listings (barcode) WHERE barcode IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Orders: 3-way settlement snapshot + sales channel + POS attribution.
--    Invariant: consignor_earnings + shop_net_earnings == seller_earnings (existing column).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS consignment_store_id uuid REFERENCES public.consignment_stores (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consignor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shop_commission_gross numeric(12, 2),
  ADD COLUMN IF NOT EXISTS shop_net_earnings numeric(12, 2),
  ADD COLUMN IF NOT EXISTS consignor_earnings numeric(12, 2),
  ADD COLUMN IF NOT EXISTS store_customer_id uuid REFERENCES public.store_customers (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pos_staff_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.sales_channel IS
  'online = Reswell web checkout; pos = in-store Stripe Terminal/cash; off_platform = recorded external sale.';
COMMENT ON COLUMN public.orders.shop_commission_gross IS
  'Shop commission on item price before the Reswell fee (consignment orders only).';
COMMENT ON COLUMN public.orders.shop_net_earnings IS
  'Shop take-home after the Reswell fee = shop_commission_gross − platform_fee (consignment orders only).';
COMMENT ON COLUMN public.orders.consignor_earnings IS
  'Consignor payout = item_price − shop_commission_gross (consignment orders only).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_sales_channel_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_sales_channel_check
      CHECK (sales_channel IN ('online', 'pos', 'off_platform'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_consignment_store_idx
  ON public.orders (consignment_store_id) WHERE consignment_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_consignor_idx
  ON public.orders (consignor_profile_id) WHERE consignor_profile_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Allow consignment ledger reference types (preserve every existing value).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_reference_type_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions
      DROP CONSTRAINT wallet_transactions_reference_type_check;
  END IF;

  ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_reference_type_check
    CHECK (
      reference_type IS NULL
      OR reference_type IN (
        'listing',
        'order_pending_earnings',
        'order_seller_earnings',
        'stripe_refund',
        'wallet_refund',
        'stripe_connect_transfer',
        'paypal_payout',
        'shipping_fee_correction',
        'consignment_order_pending_consignor',
        'consignment_order_pending_shop',
        'consignment_order_consignor_earnings',
        'consignment_order_shop_commission'
      )
    );
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Row Level Security. Server services use the service role (bypasses RLS); these
--    policies scope what authenticated shop staff / consignors / the public can read.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.consignment_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_store_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_intakes ENABLE ROW LEVEL SECURITY;

-- Stores: active stores are publicly readable (shop pages); owner/staff read their own regardless.
DROP POLICY IF EXISTS "consignment_stores_select_public" ON public.consignment_stores;
CREATE POLICY "consignment_stores_select_public" ON public.consignment_stores
  FOR SELECT
  USING (
    status = 'active'
    OR owner_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.consignment_store_staff s
      WHERE s.store_id = consignment_stores.id AND s.profile_id = auth.uid()
    )
  );

-- Staff: a person can see their own staff rows; an owner can see their store's staff.
DROP POLICY IF EXISTS "consignment_store_staff_select_self_or_owner" ON public.consignment_store_staff;
CREATE POLICY "consignment_store_staff_select_self_or_owner" ON public.consignment_store_staff
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.consignment_stores st
      WHERE st.id = consignment_store_staff.store_id AND st.owner_profile_id = auth.uid()
    )
  );

-- Customers: only the store's owner/staff can read the shop's customer list.
DROP POLICY IF EXISTS "store_customers_select_store_team" ON public.store_customers;
CREATE POLICY "store_customers_select_store_team" ON public.store_customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.consignment_stores st
      WHERE st.id = store_customers.store_id AND st.owner_profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.consignment_store_staff s
      WHERE s.store_id = store_customers.store_id AND s.profile_id = auth.uid()
    )
  );

-- Intakes: the consignor sees their own; the store's owner/staff see their store's.
DROP POLICY IF EXISTS "consignment_intakes_select_party" ON public.consignment_intakes;
CREATE POLICY "consignment_intakes_select_party" ON public.consignment_intakes
  FOR SELECT
  USING (
    consignor_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.consignment_stores st
      WHERE st.id = consignment_intakes.store_id AND st.owner_profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.consignment_store_staff s
      WHERE s.store_id = consignment_intakes.store_id AND s.profile_id = auth.uid()
    )
  );

GRANT SELECT ON public.consignment_stores TO authenticated;
GRANT SELECT ON public.consignment_store_staff TO authenticated;
GRANT SELECT ON public.store_customers TO authenticated;
GRANT SELECT ON public.consignment_intakes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_stores TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_store_staff TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignment_intakes TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Consignment-shop role. Admin-granted privilege on a profile (mirrors is_reswell_seller).
--    Owning/operating a consignment store requires this role; it grants no admin access and has
--    no store side effects on its own — an admin creates the store separately for a granted user.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_consignment_shop boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_consignment_shop IS
  'When true, this profile may own/operate a consignment store. Admin-granted only; no admin privileges.';

-- Only an admin session or the server (service role) may flip this flag; everyone else is reverted.
CREATE OR REPLACE FUNCTION public.profiles_guard_consignment_shop_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_consignment_shop IS DISTINCT FROM OLD.is_consignment_shop THEN
    IF coalesce(auth.role(), '') <> 'service_role'
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_admin IS TRUE
       )
    THEN
      NEW.is_consignment_shop := OLD.is_consignment_shop;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_consignment_shop ON public.profiles;
CREATE TRIGGER profiles_guard_consignment_shop
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_consignment_shop_privilege();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Flagship store seed — only if a granted consignment-shop profile already exists.
--     No owner is ever guessed: until an admin grants the role, this no-ops. The Reswell
--     flagship store is created once its owner has been granted is_consignment_shop.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_owner uuid;
  v_store_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.consignment_stores WHERE slug = 'reswell') THEN
    RETURN;
  END IF;

  SELECT id INTO v_owner
  FROM public.profiles
  WHERE is_consignment_shop = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner IS NULL THEN
    RAISE NOTICE 'Reswell flagship store not seeded: grant a user is_consignment_shop, then create the store via admin.';
    RETURN;
  END IF;

  INSERT INTO public.consignment_stores (slug, name, owner_profile_id, default_commission_bps, reswell_fee_bps)
  VALUES ('reswell', 'Reswell', v_owner, 2500, 700)
  RETURNING id INTO v_store_id;

  INSERT INTO public.consignment_store_staff (store_id, profile_id, role)
  VALUES (v_store_id, v_owner, 'owner')
  ON CONFLICT (store_id, profile_id) DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Settlement RPC: release a consignment order's earnings to BOTH wallets
--     (consignor + shop) when fulfillment is complete. Mirrors the single-seller
--     release_order_seller_earnings_to_wallet but splits across two parties.
--     Idempotent: a second call after the consignor leg is recorded is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_consignment_order_earnings(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_order public.orders%ROWTYPE;
  v_listing_title text;
  v_consignor numeric(12, 2);
  v_shop numeric(12, 2);

  -- consignor wallet
  r_cw public.wallets%ROWTYPE;
  v_cw_pending numeric(12, 2);
  v_cw_balance numeric(12, 2);

  -- shop wallet
  r_sw public.wallets%ROWTYPE;
  v_sw_pending numeric(12, 2);
  v_sw_balance numeric(12, 2);
BEGIN
  -- Idempotency: the consignor "available" leg is the completion marker.
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.reference_type = 'consignment_order_consignor_earnings'
      AND wt.reference_id = p_order_id::text
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO r_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF r_order.consignment_store_id IS NULL THEN
    RAISE EXCEPTION 'not_a_consignment_order';
  END IF;
  IF r_order.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'order_not_active';
  END IF;
  IF r_order.delivery_status NOT IN ('delivered', 'picked_up') THEN
    RAISE EXCEPTION 'fulfillment_incomplete';
  END IF;

  v_consignor := COALESCE(r_order.consignor_earnings, 0);
  v_shop := COALESCE(r_order.shop_net_earnings, 0);
  IF v_consignor < 0 OR v_shop < 0 THEN
    RAISE EXCEPTION 'invalid_split';
  END IF;

  SELECT COALESCE(l.title, 'Item') INTO v_listing_title
  FROM public.listings l WHERE l.id = r_order.listing_id;

  -- ── Consignor leg ───────────────────────────────────────────────
  IF r_order.consignor_profile_id IS NOT NULL AND v_consignor > 0 THEN
    SELECT * INTO r_cw FROM public.wallets WHERE user_id = r_order.consignor_profile_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.wallets (user_id) VALUES (r_order.consignor_profile_id) RETURNING * INTO r_cw;
    END IF;

    v_consignor := LEAST(v_consignor, round(r_cw.pending_balance::numeric, 2));
    IF v_consignor > 0 THEN
      v_cw_pending := GREATEST(0, round(r_cw.pending_balance::numeric - v_consignor, 2));
      v_cw_balance := round(r_cw.balance::numeric + v_consignor, 2);

      UPDATE public.wallets
      SET balance = v_cw_balance, pending_balance = v_cw_pending, updated_at = now()
      WHERE id = r_cw.id;

      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, reference_id, reference_type
      ) VALUES (
        r_cw.id, r_order.consignor_profile_id, 'sale', 0, v_cw_balance,
        format('Available — Consigned "%s" sold', v_listing_title),
        p_order_id::text, 'consignment_order_consignor_earnings'
      );
    END IF;
  END IF;

  -- ── Shop commission leg (seller_id is the store account) ─────────
  IF v_shop > 0 THEN
    SELECT * INTO r_sw FROM public.wallets WHERE user_id = r_order.seller_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.wallets (user_id) VALUES (r_order.seller_id) RETURNING * INTO r_sw;
    END IF;

    v_shop := LEAST(v_shop, round(r_sw.pending_balance::numeric, 2));
    IF v_shop > 0 THEN
      v_sw_pending := GREATEST(0, round(r_sw.pending_balance::numeric - v_shop, 2));
      v_sw_balance := round(r_sw.balance::numeric + v_shop, 2);

      UPDATE public.wallets
      SET balance = v_sw_balance, pending_balance = v_sw_pending, updated_at = now()
      WHERE id = r_sw.id;

      INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, reference_id, reference_type
      ) VALUES (
        r_sw.id, r_order.seller_id, 'sale', 0, v_sw_balance,
        format('Available — Commission on "%s" (Reswell fee: $%s)',
               v_listing_title, trim(to_char(COALESCE(r_order.platform_fee, 0), 'FM999999990.00'))),
        p_order_id::text, 'consignment_order_shop_commission'
      );
    END IF;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.release_consignment_order_earnings(uuid) IS
  'Releases a consignment order''s pending earnings to both the consignor and shop wallets once fulfillment is complete. Idempotent. Reswell fee stays on platform books.';

COMMIT;
