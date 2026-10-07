-- Each shipper sets the price buyers pay. Default stays $100.
-- Reswell collects it. owed_cents is that same amount. No payout is sent.

BEGIN;

ALTER TABLE public.coastal_shippers
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 10000;

ALTER TABLE public.coastal_shippers
  DROP CONSTRAINT IF EXISTS coastal_shippers_price_cents_check;

ALTER TABLE public.coastal_shippers
  ADD CONSTRAINT coastal_shippers_price_cents_check
  CHECK (price_cents BETWEEN 2000 AND 50000 AND price_cents % 100 = 0);

COMMENT ON COLUMN public.coastal_shippers.price_cents IS
  'Whole-dollar price the buyer pays when this shipper is matched. 2000–50000 cents. Default 10000.';

-- The flat-$100 order columns may not be on this database yet.
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
    OR (
      surfboard_shipped_owed_cents BETWEEN 2000 AND 50000
      AND surfboard_shipped_owed_cents % 100 = 0
    )
  );

COMMENT ON COLUMN public.orders.surfboard_shipped_owed_cents IS
  'Cents Reswell owes the matched shipper. Equals the price they had set when the buyer paid. No payout is sent from this column.';

COMMIT;
