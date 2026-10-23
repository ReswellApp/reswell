import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { dbUnpublishAllShopifyListingsForConnection } from "@/lib/db/shopifyCatalog"
import {
  dbGetShopifyConnectionByDomain,
  dbGetShopifyConnectionById,
  dbListShopifyConnectionsDueForReconcile,
  dbMarkShopifyConnectionStatus,
  dbRedactShopifyConnection,
  dbTouchShopifyReconciled,
  dbTouchShopifyWebhook,
  dbUpdateShopifyBilling,
  dbUpdateShopifySourceOfTruth,
} from "@/lib/db/shopifyConnections"
import { dbDeleteShopifyPendingInstallationsForShop } from "@/lib/db/shopifyPendingInstallations"
import {
  dbCancelShopifyJobsForConnection,
  dbCancelShopifyInventoryJobsForConnection,
  dbClaimShopifyJobs,
  dbClaimShopifyWebhookEvents,
  dbCompleteShopifyJob,
  dbCompleteShopifyWebhookEvent,
  dbDeferShopifyJob,
  dbEnqueueShopifyJob,
  dbFailShopifyJob,
  dbFailShopifyWebhookEvent,
  dbListUnresolvedShopifyInventoryOrderIds,
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
  shopifySaleOrderPayloadSchema,
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
import { sweepDeletedShopifyListings } from "@/lib/services/shopifyDeletionSweep"
import { compensateShopifyInventoryConflict } from "@/lib/services/shopifyInventoryCompensation"
import { ShopifyBillingRequiredError } from "@/lib/services/shopifyBilling"
import {
  applyShopifyOriginatedSale,
  pushReswellSaleToShopify,
} from "@/lib/services/shopifySale"
import {
  parseShopifySourceOfTruth,
  shopifyCatalogSyncAllowed,
} from "@/lib/shopify/billing"
import {
  pullShopifySourceOfTruth,
  shopifyMetafieldMatchesSource,
} from "@/lib/services/shopifySource"

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

async function compensateUnresolvedShopifySales(
  serviceSupabase: SupabaseClient,
  connectionId: string,
): Promise<void> {
  const orderIds = await dbListUnresolvedShopifyInventoryOrderIds(
    serviceSupabase,
    connectionId,
  )
  for (const orderId of orderIds) {
    const result = await compensateShopifyInventoryConflict({
      serviceSupabase,
      orderId,
    })
    if (result === "failed") {
      throw new Error(
        `Could not compensate Reswell order ${orderId} before Shopify disconnect`,
      )
    }
  }
  await dbCancelShopifyInventoryJobsForConnection(
    serviceSupabase,
    connectionId,
  )
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
    await dbDeleteShopifyPendingInstallationsForShop(
      serviceSupabase,
      event.shop_domain,
    )
    if (!connection) return
    await compensateUnresolvedShopifySales(serviceSupabase, connection.id)
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
    await compensateUnresolvedShopifySales(serviceSupabase, connection.id)
    await dbMarkShopifyConnectionStatus(serviceSupabase, connection.id, {
      status: "disconnected",
      syncEnabled: false,
      error: "Shopify app was uninstalled",
    })
    await dbUpdateShopifyBilling(serviceSupabase, connection.id, {
      billingStatus: "pending",
      subscriptionGid: null,
      lineItemGid: null,
      cappedAmount: null,
      approvedAt: null,
      syncEnabled: false,
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

  // Deletion only writes Reswell rows, so it runs even while sync is paused or
  // the store needs reauthorization: a deleted product must never stay live.
  if (event.topic === "orders/create") {
    if (
      !connection ||
      connection.status !== "active" ||
      !connection.orders_sync_enabled
    ) {
      return
    }
    await applyShopifyOriginatedSale({
      serviceSupabase,
      connection,
      payload: event.payload,
    })
    return
  }

  if (event.topic === "metafields/update") {
    if (!connection || connection.status === "disconnected") return
    const namespace =
      typeof event.payload.namespace === "string" ? event.payload.namespace : null
    const key = typeof event.payload.key === "string" ? event.payload.key : null
    const value = typeof event.payload.value === "string" ? event.payload.value : null
    if (!shopifyMetafieldMatchesSource({ namespace, key })) return
    const source = parseShopifySourceOfTruth(value)
    if (!source || source === connection.source_of_truth) return
    await dbUpdateShopifySourceOfTruth(serviceSupabase, connection.id, source)
    return
  }

  if (event.topic === "products/delete") {
    if (!connection) return
    if (connection.source_of_truth === "reswell") return
    const productId = shopifyGid(
      "Product",
      event.payload.admin_graphql_api_id ?? event.payload.id,
    )
    if (!productId) throw new Error("Shopify delete webhook has no product id")
    if (connection.status === "active" && connection.sync_enabled) {
      await dbTouchShopifyWebhook(serviceSupabase, connection.id)
    }
    await unpublishDeletedShopifyProduct({
      serviceSupabase,
      connectionId: connection.id,
      productId,
    })
    return
  }

  if (!connection || connection.status !== "active" || !connection.sync_enabled) {
    return
  }
  await dbTouchShopifyWebhook(serviceSupabase, connection.id)

  if (connection.source_of_truth === "reswell") return

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
  if (connection.source_of_truth === "reswell") {
    try {
      await pullShopifySourceOfTruth({ serviceSupabase, connection })
    } catch (error) {
      console.error("[shopify] source pull", { connectionId: connection.id, error })
    }
    await dbTouchShopifyReconciled(serviceSupabase, connection.id)
    return
  }
  const { liveProductIds } = await sweepDeletedShopifyListings({
    serviceSupabase,
    connection,
  })
  try {
    await pullShopifySourceOfTruth({ serviceSupabase, connection })
  } catch (error) {
    console.error("[shopify] source pull", { connectionId: connection.id, error })
  }
  for (const productId of liveProductIds) {
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
  if (connection && job.job_type === "product_delete") {
    if (connection.source_of_truth === "reswell") return
    const payload = shopifyProductJobPayloadSchema.parse(job.payload)
    await unpublishDeletedShopifyProduct({
      serviceSupabase,
      connectionId: connection.id,
      productId: payload.productId,
    })
    return
  }
  if (connection && job.job_type === "sale_order") {
    if (connection.status !== "active") return
    const payload = shopifySaleOrderPayloadSchema.parse(job.payload)
    await pushReswellSaleToShopify({
      serviceSupabase,
      connection,
      orderId: payload.orderId,
      collectVia: payload.collectVia,
      sourceOfTruth: payload.sourceOfTruth,
    })
    return
  }
  if (!connection || !shopifyCatalogSyncAllowed(connection)) {
    if (job.job_type === "inventory_decrement") {
      throw new ShopifyInventoryWritesDisabledError()
    }
    if (connection?.status === "active" && connection.billing_status !== "active") {
      throw new ShopifyBillingRequiredError()
    }
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
      workerId: job.worker_id,
      mappingId: payload.mappingId,
      orderId: payload.orderId,
      quantity: payload.quantity,
      locationId: payload.locationId,
      changeFromQuantity: payload.changeFromQuantity,
      remoteTotalBefore: payload.remoteTotalBefore,
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
      if (
        error instanceof ShopifyInventoryWritesDisabledError ||
        error instanceof ShopifyBillingRequiredError
      ) {
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
