-- ORDERS_CREATE needs Shopify's protected-customer-data approval.
-- Connect still links the store when that subscription is rejected.
-- Order sync stays off until the subscription succeeds.

BEGIN;

ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS orders_sync_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.shopify_connections.orders_sync_enabled IS
  'True when the ORDERS_CREATE webhook is subscribed. False while Shopify rejects that topic, including before protected customer data is approved.';

COMMIT;
