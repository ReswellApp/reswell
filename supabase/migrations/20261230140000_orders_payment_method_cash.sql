-- Admin terminal and in-person POS can record cash collected at the register.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('stripe', 'reswell_bucks', 'cash'));

COMMENT ON COLUMN public.orders.payment_method IS
  'stripe = card checkout; reswell_bucks = wallet; cash = in-person cash at register (admin terminal / POS).';
