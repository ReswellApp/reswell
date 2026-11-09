-- Persist the Shopify Sales Channel connection GID + handle from channelCreate.
ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS channel_gid text;

ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS channel_handle text;

COMMENT ON COLUMN public.shopify_connections.channel_gid IS
  'Shopify Channel GID from channelCreate (Sales Channel connection for Reswell).';

COMMENT ON COLUMN public.shopify_connections.channel_handle IS
  'Shopify Channel handle used for order attribution (sourceName channel:<handle>).';
