-- Production still had orders_buyer_required_unless_pos from consignment/POS era.
-- Guest admin_terminal orders (buyer_id NULL) fail until the POS constraint is removed.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_required_unless_pos;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'online';

ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_sales_channel_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_sales_channel_check;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_sales_channel_check
  CHECK (sales_channel IN ('online', 'admin_terminal', 'pos', 'off_platform'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_required_unless_admin_terminal;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_buyer_required_unless_admin_terminal
  CHECK (buyer_id IS NOT NULL OR sales_channel = 'admin_terminal');
