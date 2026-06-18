import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import {
  claimShopifySyncJobs,
  markShopifySyncJobFailed,
  markShopifySyncJobSucceeded,
} from "@/lib/db/shopify-sync-jobs"
import { getShopifyConnectionById } from "@/lib/db/shopify-connections"
import {
  executeConnectionReconcile,
  executeFullCatalogSync,
  executeProductSync,
} from "@/lib/services/shopifyCatalog"
import { archiveShopifyProductListing } from "@/lib/services/shopifyProductSync"
import {
  executeShopifyOrderPush,
  type ShopifyOrderPushPayload,
} from "@/lib/services/shopifyOrders"
import {
  executeShopifyFulfillmentPush,
  executeShopifyOrderCancel,
  type ShopifyFulfillmentPushPayload,
  type ShopifyOrderCancelPayload,
} from "@/lib/services/shopifyFulfillment"
import type { ShopifyConnectionRow, ShopifySyncJobRow } from "@/lib/shopify/types"

function requireString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key]
  if (typeof v !== "string" || !v) throw new Error(`Job payload missing "${key}"`)
  return v
}

async function loadConnectionForJob(
  serviceSupabase: SupabaseClient,
  job: ShopifySyncJobRow,
): Promise<ShopifyConnectionRow> {
  const connectionId = job.connection_id ?? (job.payload.connectionId as string | undefined)
  if (!connectionId) throw new Error("Job has no connection_id")
  const connection = await getShopifyConnectionById(serviceSupabase, connectionId)
  if (!connection) throw new Error("Connection not found")
  if (connection.status !== "active") throw new Error("Connection is not active")
  return connection
}

async function runJob(serviceSupabase: SupabaseClient, job: ShopifySyncJobRow): Promise<void> {
  switch (job.job_type) {
    case "order_push":
      await executeShopifyOrderPush(serviceSupabase, job.payload as unknown as ShopifyOrderPushPayload)
      return

    case "fulfillment_push":
      await executeShopifyFulfillmentPush(
        serviceSupabase,
        job.payload as unknown as ShopifyFulfillmentPushPayload,
      )
      return

    case "order_cancel":
      await executeShopifyOrderCancel(
        serviceSupabase,
        job.payload as unknown as ShopifyOrderCancelPayload,
      )
      return

    case "product_sync": {
      const connection = await loadConnectionForJob(serviceSupabase, job)
      await executeProductSync(serviceSupabase, connection, requireString(job.payload, "productId"))
      return
    }

    case "inventory_sync": {
      // Re-sync the whole product (variant stock + listing aggregate).
      const connection = await loadConnectionForJob(serviceSupabase, job)
      await executeProductSync(serviceSupabase, connection, requireString(job.payload, "productId"))
      return
    }

    case "product_delete": {
      const connection = await loadConnectionForJob(serviceSupabase, job)
      await archiveShopifyProductListing({
        serviceSupabase,
        connectionId: connection.id,
        productId: requireString(job.payload, "productId"),
      })
      return
    }

    case "full_catalog_sync": {
      const connection = await loadConnectionForJob(serviceSupabase, job)
      await executeFullCatalogSync(serviceSupabase, connection)
      return
    }

    case "reconcile": {
      const connection = await loadConnectionForJob(serviceSupabase, job)
      await executeConnectionReconcile(serviceSupabase, connection)
      return
    }

    default:
      throw new Error(`Unknown job type: ${job.job_type as string}`)
  }
}

export interface ShopifyWorkerResult {
  claimed: number
  succeeded: number
  failed: number
}

/**
 * Drain up to `batchSize` due jobs. Designed to be invoked by the cron route; safe to run
 * concurrently across regions (claim uses FOR UPDATE SKIP LOCKED).
 */
export async function runShopifySyncWorker(
  serviceSupabase: SupabaseClient,
  batchSize = 25,
): Promise<ShopifyWorkerResult> {
  const worker = `worker-${randomUUID().slice(0, 8)}`
  const jobs = await claimShopifySyncJobs(serviceSupabase, batchSize, worker)

  let succeeded = 0
  let failed = 0

  for (const job of jobs) {
    try {
      await runJob(serviceSupabase, job)
      await markShopifySyncJobSucceeded(serviceSupabase, job.id)
      succeeded += 1
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error("[shopify worker] job failed", { jobId: job.id, type: job.job_type, message })
      await markShopifySyncJobFailed(serviceSupabase, job, message)
      failed += 1
    }
  }

  return { claimed: jobs.length, succeeded, failed }
}
