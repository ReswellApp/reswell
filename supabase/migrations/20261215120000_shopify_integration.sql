-- Shopify seller integration: OAuth connections, product links, section mappings.
-- Imported products become normal `listings` rows (peer sections); Shopify is catalog source only.

BEGIN;

-- ── Seller access flag (admin-granted) ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shopify_connect_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.shopify_connect_enabled IS
  'When true, seller can connect a Shopify store and import/sync products as Reswell listings.';

-- ── Listings: optional source tracking ──────────────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_source text NOT NULL DEFAULT 'manual'
    CHECK (listing_source IN ('manual', 'shopify', 'fb_import'));

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sync_managed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.listing_source IS
  'How the listing was created: manual sell flow, Shopify sync, or FB import.';
COMMENT ON COLUMN public.listings.sync_managed IS
  'When true, price/inventory/status may be updated by external sync (e.g. Shopify webhooks).';

-- ── shopify_connections ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shopify_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_domain         text NOT NULL,
  access_token        text NOT NULL,
  scopes              text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'error')),
  shop_name           text,
  connected_at        timestamptz NOT NULL DEFAULT now(),
  disconnected_at     timestamptz,
  last_sync_at        timestamptz,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shopify_connections_user_id_active_idx
  ON public.shopify_connections (user_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS shopify_connections_shop_domain_active_idx
  ON public.shopify_connections (shop_domain)
  WHERE status = 'active';

ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopify_connections_select_own" ON public.shopify_connections;
CREATE POLICY "shopify_connections_select_own"
  ON public.shopify_connections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopify_connections_insert_own" ON public.shopify_connections;
CREATE POLICY "shopify_connections_insert_own"
  ON public.shopify_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopify_connections_update_own" ON public.shopify_connections;
CREATE POLICY "shopify_connections_update_own"
  ON public.shopify_connections FOR UPDATE
  USING (auth.uid() = user_id);

-- ── shopify_product_links ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shopify_product_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id         uuid NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  listing_id            uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  shopify_product_id    text NOT NULL,
  shopify_variant_id    text NOT NULL,
  reswell_section       text NOT NULL,
  sync_status           text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'error', 'unmapped', 'archived')),
  shopify_updated_at    timestamptz,
  last_synced_at        timestamptz,
  last_error            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, shopify_variant_id),
  UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS shopify_product_links_user_id_idx
  ON public.shopify_product_links (user_id);

CREATE INDEX IF NOT EXISTS shopify_product_links_listing_id_idx
  ON public.shopify_product_links (listing_id);

ALTER TABLE public.shopify_product_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopify_product_links_select_own" ON public.shopify_product_links;
CREATE POLICY "shopify_product_links_select_own"
  ON public.shopify_product_links FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/updates happen via service role in sync jobs and webhooks.

-- ── shopify_section_mappings (per-seller rules) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.shopify_section_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id         uuid REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  signal_type           text NOT NULL
    CHECK (signal_type IN ('collection', 'product_type', 'tag')),
  signal_value          text NOT NULL,
  reswell_section       text NOT NULL,
  priority              integer NOT NULL DEFAULT 100,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopify_section_mappings_user_id_idx
  ON public.shopify_section_mappings (user_id);

ALTER TABLE public.shopify_section_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopify_section_mappings_select_own" ON public.shopify_section_mappings;
CREATE POLICY "shopify_section_mappings_select_own"
  ON public.shopify_section_mappings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopify_section_mappings_insert_own" ON public.shopify_section_mappings;
CREATE POLICY "shopify_section_mappings_insert_own"
  ON public.shopify_section_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopify_section_mappings_update_own" ON public.shopify_section_mappings;
CREATE POLICY "shopify_section_mappings_update_own"
  ON public.shopify_section_mappings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopify_section_mappings_delete_own" ON public.shopify_section_mappings;
CREATE POLICY "shopify_section_mappings_delete_own"
  ON public.shopify_section_mappings FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
