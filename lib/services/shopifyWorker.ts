import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dbListSelectedShopifyProductIds,
  dbUnpublishAllShopifyListingsForConnection,
} from "@/lib/db/shopifyCatalog"
import {
  dbGetShopifyConnectionByDomain,
  dbGetShopifyConnectionById,
  dbListShopifyConnectionsDueForReconcile,
  dbMarkShopifyConnectionStatus,
  dbRedactShopifyConnection,
  dbTouchShopifyReconciled,
  dbTouchShopifyWebhook,
} from "@/lib/db/shopifyConnections"
import {
  dbCancelShopifyJobsForConnection,
  dbClaimShopifyJobs,
  dbClaimShopifyWebhookEvents,
  dbCompleteShopifyJob,
  dbCompleteShopifyWebhookEvent,
  dbDeferShopifyJob,
  dbEnqueueShopifyJob,
  dbFailShopifyJob,
  dbFailShopifyWebhookEvent,
} from "@/lib/db/shopifyQueue"
import type {
  ShopifyConnectionRow,
  ShopifySyncJobRow,
  ShopifyWebhookEventRow,
} from "@/lib/shopify/types"
import {
  shopifyInventoryDecrementPayloadSchema,
  shopifyInventoryJobPayloadSchema,
  shopifyProductJobPayloadSchema,
} from "@/lib/validations/shopify"
import {
  applyShopifyListingSideEffects,
  syncSelectedShopifyProduct,
  syncShopifyInventoryItem,
  unpublishDeletedShopifyProduct,
} from "@/lib/services/shopifyCatalog"
import {
  decrementShopifyInventoryForReswellSale,
  ShopifyInventoryWritesDisabledError,
} from "@/lib/services/shopifyInventory"

function shopifyGid(
  kind: "Product" | "InventoryItem",
  value: unknown,
): string | null {
  if (typeof value === "string" && value.startsWith(`gid://shopify/${kind}/`)) {
    return value
  }
  if (
    (typeof value === "string" || typeof value === "number") &&
    /^\d+$/.test(String(value))
  ) {
    return `gid://shopify/${kind}/${String(value)}`
  }
  return null
}

async function handleWebhookEvent(
  serviceSupabase: SupabaseClient,
  event: ShopifyWebhookEventRow,
): Promise<void> {
  const connection =
    event.connection_id != null
      ? await dbGetShopifyConnectionById(
          serviceSupabase,
          event.connection_id,
        )
      : await dbGetShopifyConnectionByDomain(
          serviceSupabase,
          event.shop_domain,
        )

  if (event.topic === "shop/redact") {
    if (!connection) return
    const listingIds = await dbRedactShopifyConnection(
      serviceSupabase,
      connection.id,
      event.shop_domain,
    )
    await applyShopifyListingSideEffects(serviceSupabase, listingIds)
    return
  }

  if (event.topic === "app/uninstalled") {
    if (!connection) return
    await dbMarkShopifyConnectionStatus(serviceSupabase, connection.id, {
      status: "disconnected",
      syncEnabled: false,
      error: "Shopify app was uninstalled",
    })
    const listingIds = await dbUnpublishAllShopifyListingsForConnection(
      serviceSupabase,
      connection.id,
    )
    await dbCancelShopifyJobsForConnection(serviceSupabase, connection.id)
    await applyShopifyListingSideEffects(serviceSupabase, listingIds)
    return
  }

  if (
    event.topic === "customers/data_request" ||
    event.topic === "customers/redact"
  ) {
    return
  }
  if (!connection || connection.status !== "active" || !connection.sync_enabled) {
    return
  }
  await dbTouchShopifyWebhook(serviceSupabase, connection.id)

  if (event.topic === "products/update") {
    const productId = shopifyGid(
      "Product",
      event.payload.admin_graphql_api_id ?? event.payload.id,
    )
    if (!productId) throw new Error("Shopify product webhook has no product id")
    await dbEnqueueShopifyJob(serviceSupabase, {
      connectionId: connection.id,
      jobType: "product_sync",
      payload: { productId },
      dedupeKey: `product:${connection.id}:${productId}`,
    })
    return
  }

  if (event.topic === "products/delete") {
    const productId = shopifyGid(
      "Product",
      event.payload.admin_graphql_api_id ?? event.payload.id,
    )
    if (!productId) throw new Error("Shopify delete webhook has no product id")
    await dbEnqueueShopifyJob(serviceSupabase, {
      connectionId: connection.id,
      jobType: "product_delete",
      payload: { productId },
      dedupeKey: `product-delete:${connection.id}:${productId}`,
    })
    return
  }

  if (event.topic === "inventory_levels/update") {
    const inventoryItemId = shopifyGid(
      "InventoryItem",
      event.payload.inventory_item_id,
    )
    if (!inventoryItemId) {
      throw new Error("Shopify inventory webhook has no inventory item id")
    }
    await dbEnqueueShopifyJob(serviceSupabase, {
      connectionId: connection.id,
      jobType: "inventory_sync",
      payload: { inventoryItemId },
      dedupeKey: `inventory:${connection.id}:${inventoryItemId}`,
    })
  }
}

async function enqueueConnectionProducts(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
): Promise<void> {
  const productIds = await dbListSelectedShopifyProductIds(
    serviceSupabase,
    connection.id,
  )
  for (const productId of productIds) {
    await dbEnqueueShopifyJob(serviceSupabase, {
      connectionId: connection.id,
      jobType: "product_sync",
      payload: { productId },
      dedupeKey: `product:${connection.id}:${productId}`,
    })
  }
  await dbTouchShopifyReconciled(serviceSupabase, connection.id)
}

async function runSyncJob(
  serviceSupabase: SupabaseClient,
  job: ShopifySyncJobRow,
): Promise<void> {
  const connection = await dbGetShopifyConnectionById(
    serviceSupabase,
    job.connection_id,
  )
  if (!connection || connection.status !== "active" || !connection.sync_enabled) {
    return
  }

  if (job.job_type === "reconcile_connection") {
    await enqueueConnectionProducts(serviceSupabase, connection)
    return
  }
  if (job.job_type === "product_sync") {
    const payload = shopifyProductJobPayloadSchema.parse(job.payload)
    await syncSelectedShopifyProduct({
      serviceSupabase,
      connection,
      productId: payload.productId,
    })
    return
  }
  if (job.job_type === "product_delete") {
    const payload = shopifyProductJobPayloadSchema.parse(job.payload)
    await unpublishDeletedShopifyProduct({
      serviceSupabase,
      connectionId: connection.id,
      productId: payload.productId,
    })
    return
  }
  if (job.job_type === "inventory_sync") {
    const payload = shopifyInventoryJobPayloadSchema.parse(job.payload)
    await syncShopifyInventoryItem({
      serviceSupabase,
      connection,
      inventoryItemId: payload.inventoryItemId,
    })
    return
  }
  if (job.job_type === "inventory_decrement") {
    const payload = shopifyInventoryDecrementPayloadSchema.parse(job.payload)
    await decrementShopifyInventoryForReswellSale({
      serviceSupabase,
      connection,
      jobId: job.id,
      mappingId: payload.mappingId,
      quantity: payload.quantity,
    })
  }
}

export async function enqueueScheduledShopifyReconciliations(
  serviceSupabase: SupabaseClient,
): Promise<number> {
  const connections = await dbListShopifyConnectionsDueForReconcile(
    serviceSupabase,
    new Date(Date.now() - 6 * 60 * 60_000).toISOString(),
  )
  let enqueued = 0
  for (const connection of connections) {
    const inserted = await dbEnqueueShopifyJob(serviceSupabase, {
      connectionId: connection.id,
      jobType: "reconcile_connection",
      payload: { connectionId: connection.id },
      dedupeKey: `reconcile:${connection.id}`,
    })
    if (inserted) enqueued += 1
  }
  return enqueued
}

export async function runShopifyWorkers(
  serviceSupabase: SupabaseClient,
  batchSize = 20,
): Promise<{
  eventsProcessed: number
  eventsFailed: number
  jobsProcessed: number
  jobsFailed: number
  jobsDeferred: number
}> {
  const workerId = `shopify-${randomUUID().slice(0, 8)}`
  const result = {
    eventsProcessed: 0,
    eventsFailed: 0,
    jobsProcessed: 0,
    jobsFailed: 0,
    jobsDeferred: 0,
  }

  const events = await dbClaimShopifyWebhookEvents(serviceSupabase, {
    limit: batchSize,
    workerId,
  })
  for (const event of events) {
    try {
      await handleWebhookEvent(serviceSupabase, event)
      await dbCompleteShopifyWebhookEvent(serviceSupabase, event)
      result.eventsProcessed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await dbFailShopifyWebhookEvent(serviceSupabase, event, message)
      result.eventsFailed += 1
    }
  }

  const jobs = await dbClaimShopifyJobs(serviceSupabase, {
    limit: batchSize,
    workerId,
  })
  for (const job of jobs) {
    try {
      await runSyncJob(serviceSupabase, job)
      await dbCompleteShopifyJob(serviceSupabase, job)
      result.jobsProcessed += 1
    } catch (error) {
      if (error instanceof ShopifyInventoryWritesDisabledError) {
        await dbDeferShopifyJob(serviceSupabase, job, error.message)
        result.jobsDeferred += 1
        continue
      }
      const message = error instanceof Error ? error.message : String(error)
      await dbFailShopifyJob(serviceSupabase, job, message)
      result.jobsFailed += 1
    }
  }

  return result
}
