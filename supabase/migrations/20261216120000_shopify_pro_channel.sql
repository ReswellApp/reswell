-- Shopify "pro" channel upgrade: durable sync jobs, real order links, variant model,
-- bidirectional inventory support, public-app token lifecycle, and seller channel settings.
--
-- Builds on 20261215120000_shopify_integration.sql. Imported products remain normal `listings`
-- rows; Shopify stays the catalog + inventory source of truth, Reswell owns checkout.

BEGIN;

-- ── Connection: token lifecycle + per-seller channel settings ─────────────────
ALTER TABLE public.shopify_connections
  ADD COLUMN IF NOT EXISTS api_version          text NOT NULL DEFAULT '2025-01',
  ADD COLUMN IF NOT EXISTS installed_via         text NOT NULL DEFAULT 'oauth'
    CHECK (installed_via IN ('oauth', 'admin', 'app_store')),
  ADD COLUMN IF NOT EXISTS uninstalled_at        timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_last_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_mode             text NOT NULL DEFAULT 'manual'
    CHECK (sync_mode IN ('manual', 'all', 'collections', 'tags')),
  ADD COLUMN IF NOT EXISTS sync_collection_ids   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sync_tags             text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_sync_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_mode          text NOT NULL DEFAULT 'mirror'
    CHECK (pricing_mode IN ('mirror', 'markup', 'compare_at')),
  ADD COLUMN IF NOT EXISTS markup_percent        numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_condition     text NOT NULL DEFAULT 'brand_new',
  ADD COLUMN IF NOT EXISTS last_full_sync_at     timestamptz;

COMMENT ON COLUMN public.shopify_connections.sync_mode IS
  'manual: seller picks products; all: auto-import every product; collections/tags: auto-import matching products.';
COMMENT ON COLUMN public.shopify_connections.pricing_mode IS
  'How Reswell listing price is derived from the Shopify variant: mirror | markup (markup_percent) | compare_at.';

-- ── Listings: variant model + retail (new) browse treatment ───────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_retail    boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.has_variants IS
  'When true, purchasable units live in listing_variants and the buyer must pick a variant.';
COMMENT ON COLUMN public.listings.is_retail IS
  'New/brand retail goods (e.g. Shopify-sourced) — surfaced with a "New" treatment, distinct from used P2P gear.';

-- ── listing_variants: one purchasable unit per Shopify variant ────────────────
CREATE TABLE IF NOT EXISTS public.listing_variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  shopify_variant_id  text,
  title               text NOT NULL,
  option1             text,
  option2             text,
  option3             text,
  sku                 text,
  price               numeric(12,2) NOT NULL DEFAULT 0,
  compare_at_price    numeric(12,2),
  stock_quantity      integer NOT NULL DEFAULT 0,
  reserved_quantity   integer NOT NULL DEFAULT 0,
  in_stock            boolean NOT NULL DEFAULT false,
  image_url           text,
  position            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, shopify_variant_id)
);

CREATE INDEX IF NOT EXISTS listing_variants_listing_id_idx
  ON public.listing_variants (listing_id);

ALTER TABLE public.listing_variants ENABLE ROW LEVEL SECURITY;

-- Public can read variants of visible listings (browse/PDP); writes are service-role only.
DROP POLICY IF EXISTS "listing_variants_select_public" ON public.listing_variants;
CREATE POLICY "listing_variants_select_public"
  ON public.listing_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_variants.listing_id
    )
  );

-- ── shopify_order_links: audit + idempotency for Reswell → Shopify orders ─────
CREATE TABLE IF NOT EXISTS public.shopify_order_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id         uuid NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  reswell_order_id      text NOT NULL,
  listing_id            uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  shopify_variant_id    text,
  shopify_order_id      text,
  shopify_order_name    text,
  shopify_fulfillment_id text,
  sync_status           text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'created', 'fulfilled', 'failed', 'cancelled', 'refunded')),
  attempts              integer NOT NULL DEFAULT 0,
  last_error            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reswell_order_id, listing_id)
);

CREATE INDEX IF NOT EXISTS shopify_order_links_user_id_idx
  ON public.shopify_order_links (user_id);
CREATE INDEX IF NOT EXISTS shopify_order_links_connection_id_idx
  ON public.shopify_order_links (connection_id);
CREATE INDEX IF NOT EXISTS shopify_order_links_reswell_order_idx
  ON public.shopify_order_links (reswell_order_id);

ALTER TABLE public.shopify_order_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopify_order_links_select_own" ON public.shopify_order_links;
CREATE POLICY "shopify_order_links_select_own"
  ON public.shopify_order_links FOR SELECT
  USING (auth.uid() = user_id);

-- ── shopify_sync_jobs: durable at-least-once queue with retries ───────────────
CREATE TABLE IF NOT EXISTS public.shopify_sync_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  job_type      text NOT NULL
    CHECK (job_type IN (
      'product_sync', 'product_delete', 'inventory_sync',
      'order_push', 'fulfillment_push', 'order_cancel',
      'full_catalog_sync', 'reconcile'
    )),
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead')),
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  run_after     timestamptz NOT NULL DEFAULT now(),
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  dedupe_key    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopify_sync_jobs_claim_idx
  ON public.shopify_sync_jobs (status, run_after)
  WHERE status IN ('queued', 'failed');

-- Coalesce duplicate pending work (e.g. repeated inventory webhooks for one variant).
CREATE UNIQUE INDEX IF NOT EXISTS shopify_sync_jobs_dedupe_idx
  ON public.shopify_sync_jobs (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running');

ALTER TABLE public.shopify_sync_jobs ENABLE ROW LEVEL SECURITY;
-- No public policies: queue is service-role only.

-- ── shopify_compliance_events: GDPR / lifecycle webhook audit trail ───────────
CREATE TABLE IF NOT EXISTS public.shopify_compliance_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain  text NOT NULL,
  topic        text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopify_compliance_events_shop_idx
  ON public.shopify_compliance_events (shop_domain, received_at DESC);

ALTER TABLE public.shopify_compliance_events ENABLE ROW LEVEL SECURITY;
-- Service-role only.

COMMIT;
