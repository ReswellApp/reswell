-- Track when an order was refunded for display in buyer/seller dashboards.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

COMMENT ON COLUMN public.orders.refunded_at IS 'Timestamp when the order was fully refunded (set by webhook or wallet refund service)';
