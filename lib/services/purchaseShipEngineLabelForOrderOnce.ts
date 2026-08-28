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
import { TOGETHER_PACKAGE_KEY } from "@/lib/shipping/packaging-mode"

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
  packageKey: string,
): Promise<{
  trackingNumber: string | null
  trackingCarrier: string | null
  labelPdfUrl: string | null
} | null> {
  if (packageKey === TOGETHER_PACKAGE_KEY) {
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

  const { data } = await supabase
    .from("order_shipping_labels")
    .select("tracking_number, tracking_carrier, label_pdf_url, label_storage_path")
    .eq("order_id", orderId)
    .or(`shipment_id.eq.${packageKey},order_item_id.eq.${packageKey}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = data as {
    tracking_number?: string | null
    tracking_carrier?: string | null
    label_pdf_url?: string | null
    label_storage_path?: string | null
  } | null
  const trackingNumber = row?.tracking_number?.trim() || null
  const labelPdfUrl = row?.label_pdf_url?.trim() || null
  const hasPdf = Boolean(labelPdfUrl || row?.label_storage_path?.trim())
  if (!trackingNumber && !hasPdf) return null
  return {
    trackingNumber,
    trackingCarrier: row?.tracking_carrier?.trim() || null,
    labelPdfUrl,
  }
}

async function waitForPurchasedLock(
  supabase: SupabaseClient,
  orderId: string,
  packageKey: string,
  attempts = 40,
  intervalMs = 500,
): Promise<ShipEngineLabelPurchaseLockRow | null> {
  for (let i = 0; i < attempts; i++) {
    const lock = await getShipEngineLabelPurchaseLock(supabase, orderId, packageKey)
    if (lock?.status === "purchased" && lock.tracking_number?.trim()) {
      return lock
    }
    if (lock?.status === "failed") {
      return lock
    }
    const existing = await loadExistingPreparedLabelSummary(supabase, orderId, packageKey)
    if (existing?.trackingNumber) {
      await syncShipEngineLabelPurchaseLockFromExisting({
        supabase,
        orderId,
        packageKey,
        trackingNumber: existing.trackingNumber,
        trackingCarrier: existing.trackingCarrier,
        labelPdfUrl: existing.labelPdfUrl,
        rateId: lock?.shipengine_rate_id ?? null,
      })
      return {
        order_id: orderId,
        package_key: packageKey,
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
 * Purchase a ShipEngine label for an order package at most once.
 * All card / wallet / admin / auto paths must call this instead of raw purchaseLabelWithRateId.
 *
 * `packageKey` is `together` for one-box labels, or `order_items.id` for separate packages.
 */
export async function purchaseShipEngineLabelForOrderOnce(params: {
  supabase: SupabaseClient
  orderId: string
  /** Stable id for this attempt (Stripe PI id, wallet:{orderId}, auto:{orderId}, admin:…). */
  ownerKey: string
  rateId: string
  packageKey?: string
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
  const packageKey = params.packageKey?.trim() || TOGETHER_PACKAGE_KEY

  const existing = await loadExistingPreparedLabelSummary(params.supabase, params.orderId, packageKey)
  if (existing?.trackingNumber) {
    await syncShipEngineLabelPurchaseLockFromExisting({
      supabase: params.supabase,
      orderId: params.orderId,
      packageKey,
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
        paperlessQrUrl: null,
        paperlessInstructions: null,
        paperlessHandoffCode: null,
      },
    }
  }

  const existingLock = await getShipEngineLabelPurchaseLock(
    params.supabase,
    params.orderId,
    packageKey,
  )
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
        paperlessQrUrl: null,
        paperlessInstructions: null,
        paperlessHandoffCode: null,
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
      packageKey,
    })
  } else if (!existingLock) {
    const inserted = await insertShipEngineLabelPurchaseLock({
      supabase: params.supabase,
      orderId: params.orderId,
      ownerKey: params.ownerKey,
      rateId,
      packageKey,
    })
    if (!inserted.ok) {
      return { ok: false, error: inserted.error, status: 500 }
    }
    acquired = inserted.inserted
  }

  if (!acquired) {
    const waited = await waitForPurchasedLock(params.supabase, params.orderId, packageKey)
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
          paperlessQrUrl: null,
          paperlessInstructions: null,
          paperlessHandoffCode: null,
        },
      }
    }
    if (waited?.status === "failed") {
      const reclaimed = await reclaimFailedShipEngineLabelPurchaseLock({
        supabase: params.supabase,
        orderId: params.orderId,
        ownerKey: params.ownerKey,
        rateId,
        packageKey,
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

  const existingAfterLock = await loadExistingPreparedLabelSummary(
    params.supabase,
    params.orderId,
    packageKey,
  )
  if (existingAfterLock?.trackingNumber) {
    await markShipEngineLabelPurchaseLockPurchased({
      supabase: params.supabase,
      orderId: params.orderId,
      ownerKey: params.ownerKey,
      packageKey,
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
        paperlessQrUrl: null,
        paperlessInstructions: null,
        paperlessHandoffCode: null,
      },
    }
  }

  const purchased = await purchaseLabelWithRateId(rateId)
  if (!purchased.ok) {
    await markShipEngineLabelPurchaseLockFailed({
      supabase: params.supabase,
      orderId: params.orderId,
      ownerKey: params.ownerKey,
      packageKey,
    })
    return purchased
  }

  const marked = await markShipEngineLabelPurchaseLockPurchased({
    supabase: params.supabase,
    orderId: params.orderId,
    ownerKey: params.ownerKey,
    packageKey,
    rateId,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    labelPdfUrl: purchased.result.labelUrl,
  })
  if (!marked.ok) {
    console.error(
      "[purchaseShipEngineLabelForOrderOnce] CRITICAL: ShipEngine label purchased but lock mark failed",
      params.orderId,
      packageKey,
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
