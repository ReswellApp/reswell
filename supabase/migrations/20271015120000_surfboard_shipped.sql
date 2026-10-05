-- Admin-only Surfboard Shipped: California coastal pickup, flat $100 at checkout.
-- Pickup name, phone, and street stay on public.addresses.
-- owed_cents is what Reswell owes the matched shipper. This migration does not pay them.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS surfboard_shipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS surfboard_shipped_pickup_address_id uuid
    REFERENCES public.addresses (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.listings.surfboard_shipped IS
  'Seller opted into Surfboard Shipped on /sell/boards. Admin-only until launch. Does not replace other shipping modes.';
COMMENT ON COLUMN public.listings.surfboard_shipped_pickup_address_id IS
  'Seller pickup row in public.addresses (name, phone, street). Routing still matches corridor stops.';

CREATE INDEX IF NOT EXISTS listings_surfboard_shipped_idx
  ON public.listings (surfboard_shipped)
  WHERE surfboard_shipped = true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS surfboard_shipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS surfboard_shipped_shipper_id uuid
    REFERENCES public.coastal_shippers (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS surfboard_shipped_run_id uuid
    REFERENCES public.coastal_shipper_runs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS surfboard_shipped_owed_cents integer,
  ADD COLUMN IF NOT EXISTS surfboard_shipped_window_start date,
  ADD COLUMN IF NOT EXISTS surfboard_shipped_window_end date;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_surfboard_shipped_owed_cents_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_surfboard_shipped_owed_cents_check
  CHECK (
    surfboard_shipped_owed_cents IS NULL
    OR surfboard_shipped_owed_cents = 10000
  );

COMMENT ON COLUMN public.orders.surfboard_shipped IS
  'Buyer paid Surfboard Shipped on this order. The $100 is shipping collected by Reswell.';
COMMENT ON COLUMN public.orders.surfboard_shipped_owed_cents IS
  'Cents Reswell owes the matched coastal shipper. 10000 when Surfboard Shipped was charged. No payout is sent from this column.';
COMMENT ON COLUMN public.orders.surfboard_shipped_window_start IS
  'First day of the 7–14 day drop-off window the buyer selected, America/Los_Angeles.';
COMMENT ON COLUMN public.orders.surfboard_shipped_window_end IS
  'Last day of the 7–14 day drop-off window the buyer selected, America/Los_Angeles.';

COMMIT;
