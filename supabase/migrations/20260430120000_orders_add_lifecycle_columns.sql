-- Add delivery / pickup columns expected by checkout when the full
-- orders_archive_and_rebuild migration has not been applied yet.
-- Fixes PostgREST PGRST204: "Could not find the 'delivery_status' column of 'orders'"

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_carrier text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_code text;

UPDATE public.orders
SET delivery_status = 'delivered'
WHERE delivery_status IS NULL;

ALTER TABLE public.orders ALTER COLUMN delivery_status SET DEFAULT 'pending';

ALTER TABLE public.orders ALTER COLUMN delivery_status SET NOT NULL;

COMMENT ON COLUMN public.orders.delivery_status IS
  'pending → shipped (tracking added) → delivered (buyer confirms) OR pickup_ready → picked_up (code verified).';
COMMENT ON COLUMN public.orders.pickup_code IS
  'Random 6-digit code the buyer shows to the seller to confirm local pickup and release payout.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'orders'
      AND c.conname = 'orders_delivery_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_status_check CHECK (
        delivery_status IN ('pending', 'shipped', 'delivered', 'pickup_ready', 'picked_up')
      )
      NOT VALID;
    ALTER TABLE public.orders VALIDATE CONSTRAINT orders_delivery_status_check;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_payment_intent_uidx ON public.orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL
    AND trim(stripe_checkout_session_id) <> '';
