-- A disconnected Shopify row keeps shop_domain and shop_gid so the merchant
-- can see and reconnect the same store, but it is not a live link. Unique
-- ownership must match that rule, or another Reswell account cannot take over
-- the shop after the previous owner disconnects.

BEGIN;

ALTER TABLE public.shopify_connections
  DROP CONSTRAINT IF EXISTS shopify_connections_shop_unique;

CREATE UNIQUE INDEX IF NOT EXISTS shopify_connections_shop_domain_active_uidx
  ON public.shopify_connections (shop_domain)
  WHERE status <> 'disconnected';

DROP INDEX IF EXISTS shopify_connections_shop_gid_uidx;

CREATE UNIQUE INDEX shopify_connections_shop_gid_uidx
  ON public.shopify_connections (shop_gid)
  WHERE shop_gid IS NOT NULL AND status <> 'disconnected';

COMMIT;
