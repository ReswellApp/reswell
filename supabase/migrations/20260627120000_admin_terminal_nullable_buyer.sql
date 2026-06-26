-- Admin Stripe Terminal: walk-in guests without Reswell accounts.
-- Customer contact on orders.shipping_address; buyer_id NULL only for admin_terminal.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'online';

ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;

COMMENT ON COLUMN public.orders.sales_channel IS
  'online = web checkout; admin_terminal = in-person Stripe Terminal sale (guest buyer allowed).';

COMMENT ON COLUMN public.orders.buyer_id IS
  'Buyer auth user id for online checkout. NULL for admin_terminal walk-in guests.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_sales_channel_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_sales_channel_check
      CHECK (sales_channel IN ('online', 'admin_terminal'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_required_unless_admin_terminal'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_buyer_required_unless_admin_terminal
      CHECK (buyer_id IS NOT NULL OR sales_channel = 'admin_terminal');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_sales_channel_idx ON public.orders (sales_channel);
