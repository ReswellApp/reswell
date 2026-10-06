import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetShopifyConnectionForUser,
  dbMarkShopifyConnectionStatus,
  toPublicShopifyConnection,
} from "@/lib/db/shopifyConnections"
import {
  dbUnpublishAllShopifyListingsForConnection,
} from "@/lib/db/shopifyCatalog"
import {
  dbCancelShopifyJobsForConnection,
  dbEnqueueShopifyJob,
} from "@/lib/db/shopifyQueue"
import type {
  PublicShopifyConnection,
  ShopifyCatalogProduct,
  ShopifyConnectionRow,
} from "@/lib/shopify/types"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import {
  applyShopifyListingSideEffects,
  listShopifyProductsForMerchant,
  syncSelectedShopifyProduct,
  unpublishSelectedShopifyProduct,
} from "@/lib/services/shopifyCatalog"

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

function serviceClient(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

async function activeConnection(
  userId: string,
): Promise<
  | { service: ReturnType<typeof createServiceRoleClient>; connection: ShopifyConnectionRow }
  | { error: string; status: number }
> {
  const service = serviceClient()
  if (!service) return { error: "Server configuration error", status: 503 }
  const connection = await dbGetShopifyConnectionForUser(service, userId)
  if (!connection) return { error: "Connect a Shopify store first", status: 404 }
  if (connection.status !== "active" || !connection.sync_enabled) {
    return { error: "Reconnect Shopify to continue", status: 409 }
  }
  return { service, connection }
}

export async function getShopifyConnectionStatus(
  userId: string,
): Promise<ServiceResult<PublicShopifyConnection | null>> {
  const service = serviceClient()
  if (!service) {
    return { ok: false, status: 503, error: "Server configuration error" }
  }
  try {
    const connection = await dbGetShopifyConnectionForUser(service, userId)
    return {
      ok: true,
      data: connection ? toPublicShopifyConnection(connection) : null,
    }
  } catch (error) {
    console.error("[shopify] status", error)
    return { ok: false, status: 500, error: "Could not load Shopify status" }
  }
}

export async function listMerchantShopifyProducts(input: {
  userId: string
  query?: string
  after?: string | null
}): Promise<
  ServiceResult<{
    products: ShopifyCatalogProduct[]
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }>
> {
  try {
    const loaded = await activeConnection(input.userId)
    if ("error" in loaded) {
      return { ok: false, status: loaded.status, error: loaded.error }
    }
    const data = await listShopifyProductsForMerchant({
      serviceSupabase: loaded.service,
      connection: loaded.connection,
      query: input.query,
      after: input.after,
    })
    return { ok: true, data }
  } catch (error) {
    console.error("[shopify] products", error)
    return { ok: false, status: 502, error: "Could not load Shopify products" }
  }
}

export async function selectMerchantShopifyProduct(input: {
  userId: string
  productId: string
  section: PeerListingSection
}): Promise<ServiceResult<{ listingIds: string[] }>> {
  try {
    const loaded = await activeConnection(input.userId)
    if ("error" in loaded) {
      return { ok: false, status: loaded.status, error: loaded.error }
    }
    const synced = await syncSelectedShopifyProduct({
      serviceSupabase: loaded.service,
      connection: loaded.connection,
      productId: input.productId,
      section: input.section,
    })
    if (synced.productMissing) {
      return {
        ok: false,
        status: 404,
        error: "That product no longer exists in Shopify",
      }
    }
    return { ok: true, data: { listingIds: synced.listingIds } }
  } catch (error) {
    console.error("[shopify] select product", error)
    return {
      ok: false,
      status: 502,
      error:
        error instanceof Error && error.message.includes("more than 100 variants")
          ? error.message
          : "Could not publish this Shopify product",
    }
  }
}

export async function unpublishMerchantShopifyProduct(input: {
  userId: string
  productId: string
}): Promise<ServiceResult<{ listingIds: string[] }>> {
  try {
    const loaded = await activeConnection(input.userId)
    if ("error" in loaded) {
      return { ok: false, status: loaded.status, error: loaded.error }
    }
    const listingIds = await unpublishSelectedShopifyProduct({
      serviceSupabase: loaded.service,
      connection: loaded.connection,
      productId: input.productId,
    })
    return { ok: true, data: { listingIds } }
  } catch (error) {
    console.error("[shopify] unpublish product", error)
    return { ok: false, status: 500, error: "Could not unpublish this product" }
  }
}

export async function requestShopifyReconciliation(
  userId: string,
): Promise<ServiceResult<{ enqueued: boolean }>> {
  try {
    const loaded = await activeConnection(userId)
    if ("error" in loaded) {
      return { ok: false, status: loaded.status, error: loaded.error }
    }
    const enqueued = await dbEnqueueShopifyJob(loaded.service, {
      connectionId: loaded.connection.id,
      jobType: "reconcile_connection",
      payload: { connectionId: loaded.connection.id },
      dedupeKey: `reconcile:${loaded.connection.id}`,
    })
    return { ok: true, data: { enqueued } }
  } catch (error) {
    console.error("[shopify] reconcile", error)
    return { ok: false, status: 500, error: "Could not queue Shopify sync" }
  }
}

export async function disconnectMerchantShopify(
  userId: string,
): Promise<ServiceResult<{ listingIds: string[] }>> {
  const service = serviceClient()
  if (!service) {
    return { ok: false, status: 503, error: "Server configuration error" }
  }
  try {
    const connection = await dbGetShopifyConnectionForUser(service, userId)
    if (!connection) return { ok: true, data: { listingIds: [] } }
    await dbMarkShopifyConnectionStatus(service, connection.id, {
      status: "disconnected",
      syncEnabled: false,
      error: null,
    })
    const listingIds = await dbUnpublishAllShopifyListingsForConnection(
      service,
      connection.id,
    )
    await dbCancelShopifyJobsForConnection(service, connection.id)
    await applyShopifyListingSideEffects(service, listingIds)
    return { ok: true, data: { listingIds } }
  } catch (error) {
    console.error("[shopify] disconnect", error)
    return { ok: false, status: 500, error: "Could not disconnect Shopify" }
  }
}
