-- Purge admin-seeded test purchase orders.
-- Related rows cascade (payouts, shipping labels, support requests, etc.) or SET NULL.

DELETE FROM public.payouts p
USING public.orders o
WHERE p.order_id = o.id
  AND o.is_admin_test = true;

DELETE FROM public.orders
WHERE is_admin_test = true;
