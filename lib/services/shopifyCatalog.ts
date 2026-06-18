import type { SupabaseClient } from "@supabase/supabase-js"
import { listShopifyProducts } from "@/lib/shopify/admin-api"
import { enqueueShopifySyncJob } from "@/lib/db/shopify-sync-jobs"
import { markShopifyConnectionSync } from "@/lib/db/shopify-connections"
import { syncShopifyProductToListing } from "@/lib/services/shopifyProductSync"
import type { ShopifyConnectionRow, ShopifyRestProduct } from "@/lib/shopify/types"

/**
 * Whether a Shopify product should be auto-imported given the connection's sync rules.
 *  - manual: never auto (seller picks in the dashboard)
 *  - all: every product
 *  - tags: product carries any of the configured sync_tags
 *  - collections: handled via collection-scoped enqueue (see {@link executeFullCatalogSync})
 */
export function productMatchesSyncRules(
  product: ShopifyRestProduct,
  connection: Pick<ShopifyConnectionRow, "sync_mode" | "sync_tags">,
): boolean {
  switch (connection.sync_mode) {
    case "all":
      return true
    case "tags": {
      if (connection.sync_tags.length === 0) return false
      const tags = (product.tags ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
      return connection.sync_tags.some((t) => tags.includes(t.trim().toLowerCase()))
    }
    case "collections":
    case "manual":
    default:
      return false
  }
}

/**
 * Full catalog sync: page the shop's products and enqueue a `product_sync` job for each one
 * matching the connection's rules. Runs in the background worker, not the request path.
 */
export async function executeFullCatalogSync(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
): Promise<{ scanned: number; enqueued: number }> {
  let pageInfo: string | null = null
  let scanned = 0
  let enqueued = 0

  do {
    const { products, nextPageInfo } = await listShopifyProducts({
      shopDomain: connection.shop_domain,
      accessToken: connection.access_token,
      limit: 250,
      pageInfo,
    })

    for (const product of products) {
      scanned += 1
      if (!productMatchesSyncRules(product, connection)) continue
      const { enqueued: didEnqueue } = await enqueueShopifySyncJob(serviceSupabase, {
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "product_sync",
        dedupeKey: `product_sync:${connection.id}:${product.id}`,
        payload: { connectionId: connection.id, sellerId: connection.user_id, productId: String(product.id) },
      })
      if (didEnqueue) enqueued += 1
    }

    pageInfo = nextPageInfo
  } while (pageInfo)

  await markShopifyConnectionSync(serviceSupabase, connection.id, null)
  await serviceSupabase
    .from("shopify_connections")
    .update({ last_full_sync_at: new Date().toISOString() })
    .eq("id", connection.id)

  return { scanned, enqueued }
}

/**
 * Reconcile: re-sync every product already linked for a connection. Catches webhooks that were
 * missed during downtime so Reswell never drifts from Shopify.
 */
export async function executeConnectionReconcile(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
): Promise<{ enqueued: number }> {
  const { data: links } = await serviceSupabase
    .from("shopify_product_links")
    .select("shopify_product_id")
    .eq("connection_id", connection.id)

  const productIds = [...new Set((links ?? []).map((l) => String(l.shopify_product_id)))]
  let enqueued = 0
  for (const productId of productIds) {
    const { enqueued: didEnqueue } = await enqueueShopifySyncJob(serviceSupabase, {
      userId: connection.user_id,
      connectionId: connection.id,
      jobType: "product_sync",
      dedupeKey: `product_sync:${connection.id}:${productId}`,
      payload: { connectionId: connection.id, sellerId: connection.user_id, productId },
    })
    if (didEnqueue) enqueued += 1
  }
  return { enqueued }
}

/** Worker handler: sync a single Shopify product into one Reswell listing + variants. */
export async function executeProductSync(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
  productId: string,
): Promise<void> {
  const result = await syncShopifyProductToListing({
    serviceSupabase,
    connection,
    productId,
    replaceImages: false,
  })
  if (!result.ok && !result.unmapped) {
    throw new Error(result.error)
  }
}
