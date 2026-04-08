-- Ensure new order rows get an id even when the client omits it (fixes NOT NULL id if default was lost).
ALTER TABLE public.orders
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
