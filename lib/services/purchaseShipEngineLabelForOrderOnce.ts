import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getLatestAdminLabelUrlsForOrder,
} from "@/lib/db/adminOrderShippingLabels"
import { getLatestOrderShippingLabelUrlsForOrder } from "@/lib/db/orderShippingLabels"
import {
  getShipEngineLabelPurchaseLock,
  insertShipEngineLabelPurchaseLock,
  markShipEngineLabelPurchaseLockFailed,
  markShipEngineLabelPurchaseLockPurchased,
  reclaimFailedShipEngineLabelPurchaseLock,
  syncShipEngineLabelPurchaseLockFromExisting,
  type ShipEngineLabelPurchaseLockRow,
} from "@/lib/db/shipEngineLabelPurchaseLocks"
import { purchaseLabelWithRateId } from "@/lib/services/orderShippingLabel"
import type { PurchasedShipEngineLabelResult } from "@/lib/shipengine/surfboard-label"

export type { PurchasedShipEngineLabelResult }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadOrderTracking(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ trackingNumber: string | null; trackingCarrier: string | null }> {
  const { data } = await supabase
    .from("orders")
    .select("tracking_number, tracking_carrier")
    .eq("id", orderId)
    .maybeSingle()
  const row = data as {
    tracking_number?: string | null
    tracking_carrier?: string | null
  } | null
  return {
    trackingNumber: row?.tracking_number?.trim() || null,
    trackingCarrier: row?.tracking_carrier?.trim() || null,
  }
}

async function loadExistingPreparedLabelSummary(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{
  trackingNumber: string | null
  trackingCarrier: string | null
  labelPdfUrl: string | null
} | null> {
  const order = await loadOrderTracking(supabase, orderId)
  const [marketplace, admin] = await Promise.all([
    getLatestOrderShippingLabelUrlsForOrder(supabase, orderId),
    getLatestAdminLabelUrlsForOrder(supabase, orderId),
  ])
  const labelPdfUrl =
    marketplace?.label_pdf_url?.trim() ||
    admin?.label_pdf_url?.trim() ||
    null
  const hasPdf = Boolean(labelPdfUrl || marketplace?.label_storage_path || admin?.label_storage_path)
  if (!order.trackingNumber && !hasPdf) return null
  return {
    trackingNumber: order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    labelPdfUrl,
  }
}

async function waitForPurchasedLock(
  supabase: SupabaseClient,
  orderId: string,
  attempts = 40,
  intervalMs = 500,
): Promise<ShipEngineLabelPurchaseLockRow | null> {
  for (let i = 0; i < attempts; i++) {
    const lock = await getShipEngineLabelPurchaseLock(supabase, orderId)
    if (lock?.status === "purchased" && lock.tracking_number?.trim()) {
      return lock
    }
    if (lock?.status === "failed") {
      return lock
    }
    const existing = await loadExistingPreparedLabelSummary(supabase, orderId)
    if (existing?.trackingNumber) {
      await syncShipEngineLabelPurchaseLockFromExisting({
        supabase,
        orderId,
        trackingNumber: existing.trackingNumber,
        trackingCarrier: existing.trackingCarrier,
        labelPdfUrl: existing.labelPdfUrl,
        rateId: lock?.shipengine_rate_id ?? null,
      })
      return {
        order_id: orderId,
        owner_key: "synced_existing",
        status: "purchased",
        shipengine_rate_id: lock?.shipengine_rate_id ?? null,
        tracking_number: existing.trackingNumber,
        tracking_carrier: existing.trackingCarrier,
        label_pdf_url: existing.labelPdfUrl,
        created_at: "",
        updated_at: "",
      }
    }
    await sleep(intervalMs)
  }
  return null
}

/**
 * Purchase a ShipEngine label for an order at most once.
 * All card / wallet / admin / auto paths must call this instead of raw purchaseLabelWithRateId.
 */
export async function purchaseShipEngineLabelForOrderOnce(params: {
  supabase: SupabaseClient
  orderId: string
  /** Stable id for this attempt (Stripe PI id, wallet:{orderId}, auto:{orderId}, admin:…). */
  ownerKey: string
  rateId: string
}): Promise<
  | {
      ok: true
      alreadyPurchased: boolean
      result: PurchasedShipEngineLabelResult
    }
  | { ok: false; error: string; status: number }
> {
  const rateId = params.rateId.trim()
  if (!rateId) {
    return { ok: false, error: "Missing ShipEngine rate id.", status: 400 }
  }

  const existing = await loadExistingPreparedLabelSummary(params.supabase, params.orderId)
  if (existing?.trackingNumber) {
    await syncShipEngineLabelPurchaseLockFromExisting({
      supabase: params.supabase,
      orderId: params.orderId,
      trackingNumber: existing.trackingNumber,
      trackingCarrier: existing.trackingCarrier,
      labelPdfUrl: existing.labelPdfUrl,
      rateId,
    })
    return {
      ok: true,
      alreadyPurchased: true,
      result: {
        labelUrl: existing.labelPdfUrl,
        trackingNumber: existing.trackingNumber,
        trackingCarrier: existing.trackingCarrier ?? "Carrier",
        costAmount: null,
        costCurrency: null,
      },
    }
  }

  const existingLock = await getShipEngineLabelPurchaseLock(params.supabase, params.orderId)
  if (existingLock?.status === "purchased" && existingLock.tracking_number?.trim()) {
    return {
      ok: true,
      alreadyPurchased: true,
      result: {
        labelUrl: existingLock.label_pdf_url,
        trackingNumber: existingLock.tracking_number.trim(),
        trackingCarrier: existingLock.tracking_carrier?.trim() || "Carrier",
        costAmount: null,
        costCurrency: null,
      },
    }
  }

  let acquired = false

  if (existingLock?.status === "failed") {
    acquired = await reclaimFailedShipEngineLabelPurchaseLock({
      supabase: params.supabase,
      orderId: params.orderId,
      ownerKey: params.ownerKey,
      rateId,
    })
  } else if (!existingLock) {
    const inserted = await insertShipEngineLabelPurchaseLock({
      supabase: params.supabase,
      orderId: params.orderId,
      ownerKey: params.ownerKey,
      rateId,
    })
    if (!inserted.ok) {
      return { ok: false, error: inserted.error, status: 500 }
    }
    acquired = inserted.inserted
  }

  if (!acquired) {
    const waited = await waitForPurchasedLock(params.supabase, params.orderId)
    if (waited?.status === "purchased" && waited.tracking_number?.trim()) {
      return {
        ok: true,
        alreadyPurchased: true,
        result: {
          labelUrl: waited.label_pdf_url,
          trackingNumber: waited.tracking_number.trim(),
          trackingCarrier: waited.tracking_carrier?.trim() || "Carrier",
          costAmount: null,
          costCurrency: null,
        },
      }
    }
    if (waited?.status === "failed") {
      const reclaimed = await reclaimFailedShipEngineLabelPurchaseLock({
        supabase: params.supabase,
        orderId: params.orderId,
        ownerKey: params.ownerKey,
        rateId,
      })
      if (!reclaimed) {
        return {
          ok: false,
          error: "Label purchase is still in progress. Wait a few seconds and try again.",
          status: 409,
        }
      }
      acquired = true
    } else {
      return {
        ok: false,
        error: "Label purchase is still in progress. Wait a few seconds and try again.",
        status: 409,
      }
    }
  }

  // Re-check after acquiring the lock (another worker may have finished attach).
  const existingAfterLock = await loadExistingPreparedLabelSummary(params.supabase, params.orderId)
  if (existingAfterLock?.trackingNumber) {
    await markShipEngineLabelPurchaseLockPurchased({
      supabase: params.supabase,
      orderId: params.orderId,
      ownerKey: params.ownerKey,
      rateId,
      trackingNumber: existingAfterLock.trackingNumber,
      trackingCarrier: existingAfterLock.trackingCarrier,
      labelPdfUrl: existingAfterLock.labelPdfUrl,
    })
    return {
      ok: true,
      alreadyPurchased: true,
      result: {
        labelUrl: existingAfterLock.labelPdfUrl,
        trackingNumber: existingAfterLock.trackingNumber,
        trackingCarrier: existingAfterLock.trackingCarrier ?? "Carrier",
        costAmount: null,
        costCurrency: null,
      },
    }
  }

  const purchased = await purchaseLabelWithRateId(rateId)
  if (!purchased.ok) {
    await markShipEngineLabelPurchaseLockFailed({
      supabase: params.supabase,
      orderId: params.orderId,
      ownerKey: params.ownerKey,
    })
    return purchased
  }

  const marked = await markShipEngineLabelPurchaseLockPurchased({
    supabase: params.supabase,
    orderId: params.orderId,
    ownerKey: params.ownerKey,
    rateId,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    labelPdfUrl: purchased.result.labelUrl,
  })
  if (!marked.ok) {
    // Label was purchased — do not fail open into a retry that buys again.
    console.error(
      "[purchaseShipEngineLabelForOrderOnce] CRITICAL: ShipEngine label purchased but lock mark failed",
      params.orderId,
      purchased.result.trackingNumber,
      marked.error,
    )
  }

  return {
    ok: true,
    alreadyPurchased: false,
    result: purchased.result,
  }
}
