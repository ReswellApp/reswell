-- Allow marketplace card checkout without a Supabase auth user (true guest).
-- Orders are still created by the service role; buyer receipt uses order id + service read.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;

ALTER TABLE public.orders
  ALTER COLUMN buyer_id DROP NOT NULL;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.orders.buyer_id IS
  'Buyer auth user id when known; NULL for sessionless guest card checkout (see guest_buyer_email).';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_buyer_email text;

COMMENT ON COLUMN public.orders.guest_buyer_email IS
  'Buyer email captured at checkout when buyer_id is NULL (guest card orders).';
