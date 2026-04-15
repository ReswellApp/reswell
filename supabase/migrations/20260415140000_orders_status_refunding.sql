-- Allow in-progress Stripe refunds to surface as "Refund in progress" before funds settle.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN ('pending', 'confirmed', 'refunding', 'refunded')
  );

COMMENT ON COLUMN public.orders.status IS
  'pending | confirmed | refunding (Stripe refund initiated, not yet settled) | refunded';
