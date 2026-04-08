-- Production-safe: keep history in orders_archive, rebuild public.orders with explicit constraints,
-- migrate all rows (same ids), repoint payouts FK, restore RLS + pending-payout trigger.
-- Run during low traffic; holds an exclusive lock on public.orders while renaming.

-- 1) Stop auto-payout trigger (recreated on new orders at end).
DROP TRIGGER IF EXISTS orders_after_insert_pending_payout ON public.orders;

-- 2) Archive current table (policies + trigger name move with the table).
ALTER TABLE public.orders RENAME TO orders_archive;

COMMENT ON TABLE public.orders_archive IS
  'Frozen snapshot of marketplace orders before 2026-04 rebuild. Not used by the app; service role / SQL only.';

DROP POLICY IF EXISTS "orders_select_as_buyer" ON public.orders_archive;
DROP POLICY IF EXISTS "orders_select_as_seller" ON public.orders_archive;
DROP POLICY IF EXISTS "orders_insert_as_buyer" ON public.orders_archive;

DROP TRIGGER IF EXISTS orders_after_insert_pending_payout ON public.orders_archive;

ALTER TABLE public.orders_archive ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.orders_archive FROM PUBLIC;
REVOKE ALL ON TABLE public.orders_archive FROM anon;
REVOKE ALL ON TABLE public.orders_archive FROM authenticated;

-- 3) New canonical orders table
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  amount numeric(12, 2) NOT NULL,
  platform_fee numeric(12, 2) NOT NULL,
  seller_earnings numeric(12, 2) NOT NULL,

  status text NOT NULL DEFAULT 'confirmed',
  payment_method text NOT NULL,
  stripe_checkout_session_id text,
  fulfillment_method text,
  shipping_address jsonb,

  -- Tracking & delivery lifecycle
  delivery_status text NOT NULL DEFAULT 'pending',
  tracking_number text,
  tracking_carrier text,
  pickup_code text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT orders_status_check CHECK (
    status IN ('pending', 'confirmed', 'refunded')
  ),
  CONSTRAINT orders_fulfillment_method_check CHECK (
    fulfillment_method IS NULL
    OR fulfillment_method IN ('pickup', 'shipping')
  ),
  CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('stripe', 'reswell_bucks')
  ),
  CONSTRAINT orders_delivery_status_check CHECK (
    delivery_status IN ('pending', 'shipped', 'delivered', 'pickup_ready', 'picked_up')
  )
);

COMMENT ON TABLE public.orders IS
  'Marketplace checkout order (buyer, seller, listing, payment snapshot, fulfillment lifecycle).';
COMMENT ON COLUMN public.orders.stripe_checkout_session_id IS
  'Stripe PaymentIntent id (legacy column name; set by card checkout).';
COMMENT ON COLUMN public.orders.payment_method IS
  'stripe = card (Stripe); reswell_bucks = in-app wallet checkout.';
COMMENT ON COLUMN public.orders.delivery_status IS
  'pending → shipped (tracking added) → delivered (buyer confirms) OR pickup_ready → picked_up (code verified).';
COMMENT ON COLUMN public.orders.pickup_code IS
  'Random 6-digit code the buyer shows to the seller to confirm local pickup and release payout.';

CREATE INDEX orders_buyer_created_idx ON public.orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller_created_idx ON public.orders (seller_id, created_at DESC);

CREATE UNIQUE INDEX orders_stripe_payment_intent_uidx ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL
    AND trim(stripe_checkout_session_id) <> '';

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;

-- 4) Migrate every archived row.
INSERT INTO public.orders (
  id, listing_id, buyer_id, seller_id,
  amount, platform_fee, seller_earnings,
  status, payment_method, stripe_checkout_session_id,
  fulfillment_method, shipping_address,
  delivery_status, created_at
)
SELECT
  o.id, o.listing_id, o.buyer_id, o.seller_id,
  o.amount, o.platform_fee, o.seller_earnings,
  CASE WHEN trim(coalesce(o.status, '')) IN ('pending', 'confirmed', 'refunded')
       THEN o.status ELSE 'confirmed' END,
  CASE WHEN o.stripe_checkout_session_id IS NOT NULL
            AND trim(o.stripe_checkout_session_id) <> ''
       THEN 'stripe' ELSE 'reswell_bucks' END,
  o.stripe_checkout_session_id,
  o.fulfillment_method,
  CASE WHEN o.shipping_address IS NULL THEN NULL::jsonb
       WHEN trim(both from o.shipping_address::text) = '' THEN NULL::jsonb
       ELSE o.shipping_address::jsonb END,
  'delivered',
  coalesce(o.created_at, now())
FROM public.orders_archive o;

-- 5) Point payouts at the new orders table.
DO $$
DECLARE
  fk_name text;
BEGIN
  IF to_regclass('public.payouts') IS NULL THEN RETURN; END IF;
  SELECT c.conname INTO fk_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.payouts'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.orders_archive'::regclass
  LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payouts DROP CONSTRAINT %I', fk_name);
  ELSE
    ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_order_id_fkey;
  END IF;
  ALTER TABLE public.payouts
    ADD CONSTRAINT payouts_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE CASCADE;
END $$;

-- 5b) Orders that predated payouts: add a pending payout row.
DO $$
BEGIN
  IF to_regclass('public.payouts') IS NULL THEN RETURN; END IF;
  INSERT INTO public.payouts (order_id, seller_id, amount, status)
  SELECT o.id, o.seller_id, o.seller_earnings, 'pending'
  FROM public.orders o
  WHERE NOT EXISTS (SELECT 1 FROM public.payouts p WHERE p.order_id = o.id);
END $$;

-- 6) RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_as_buyer"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "orders_select_as_seller"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "orders_insert_as_buyer"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "orders_update_as_buyer"
  ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "orders_update_as_seller"
  ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- 7) Pending payout trigger (recreated, now sets hold_reason).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'orders_create_pending_payout'
  ) THEN
    DROP TRIGGER IF EXISTS orders_after_insert_pending_payout ON public.orders;
    CREATE TRIGGER orders_after_insert_pending_payout
      AFTER INSERT ON public.orders
      FOR EACH ROW
      EXECUTE FUNCTION public.orders_create_pending_payout();
  END IF;
END $$;

DROP TABLE public.orders_archive;
