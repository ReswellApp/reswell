-- Persist the Shopify Sales Channel connection GID created via channelCreate.
ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS channel_gid text;

COMMENT ON COLUMN public.shopify_connections.channel_gid IS
  'Shopify Channel GID from channelCreate (Sales Channel connection for Reswell).';
