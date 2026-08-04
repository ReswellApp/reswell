import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getOrderItemReturnById,
  returnHasLabelPdf,
} from "@/lib/db/orderItemReturns"
import {
  getOrderItemReturnLabelPurchaseLock,
  insertOrderItemReturnLabelPurchaseLock,
  markOrderItemReturnLabelPurchaseLockFailed,
  markOrderItemReturnLabelPurchaseLockPurchased,
  reclaimFailedOrderItemReturnLabelPurchaseLock,
} from "@/lib/db/orderItemReturnLabelPurchaseLocks"
import { purchaseLabelWithRateId } from "@/lib/services/orderShippingLabel"
import type { PurchasedShipEngineLabelResult } from "@/lib/shipengine/surfboard-label"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resultFromExisting(params: {
  trackingNumber: string | null
  trackingCarrier: string | null
  labelPdfUrl: string | null
  paperlessQrUrl?: string | null
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
  costAmount?: number | null
  costCurrency?: string | null
}): PurchasedShipEngineLabelResult {
  return {
    labelUrl: params.labelPdfUrl,
    trackingNumber: params.trackingNumber?.trim() || "",
    trackingCarrier: params.trackingCarrier?.trim() || "Carrier",
    costAmount: params.costAmount ?? null,
    costCurrency: params.costCurrency ?? null,
    paperlessQrUrl: params.paperlessQrUrl ?? null,
    paperlessInstructions: params.paperlessInstructions ?? null,
    paperlessHandoffCode: params.paperlessHandoffCode ?? null,
  }
}

async function waitForPurchasedLock(
  supabase: SupabaseClient,
  returnId: string,
  attempts = 40,
  intervalMs = 500,
): Promise<PurchasedShipEngineLabelResult | null> {
  for (let i = 0; i < attempts; i++) {
    const lock = await getOrderItemReturnLabelPurchaseLock(supabase, returnId)
    if (lock?.status === "purchased" && (lock.tracking_number?.trim() || lock.label_pdf_url?.trim())) {
      return resultFromExisting({
        trackingNumber: lock.tracking_number,
        trackingCarrier: lock.tracking_carrier,
        labelPdfUrl: lock.label_pdf_url,
      })
    }
    if (lock?.status === "failed") return null

    const existing = await getOrderItemReturnById(supabase, returnId)
    if (existing && (existing.tracking_number?.trim() || returnHasLabelPdf(existing))) {
      return resultFromExisting({
        trackingNumber: existing.tracking_number,
        trackingCarrier: existing.tracking_carrier,
        labelPdfUrl: existing.label_pdf_url,
        paperlessQrUrl: existing.paperless_qr_url,
        paperlessInstructions: existing.paperless_instructions,
        paperlessHandoffCode: existing.paperless_handoff_code,
        costAmount: existing.label_cost_usd != null ? Number(existing.label_cost_usd) : null,
        costCurrency: existing.label_cost_currency,
      })
    }

    await sleep(intervalMs)
  }
  return null
}

/**
 * Idempotent ShipEngine return-label purchase for one `order_item_returns` row.
 */
export async function purchaseShipEngineLabelForReturnOnce(params: {
  supabase: SupabaseClient
  returnId: string
  rateId: string
  ownerKey: string
}): Promise<
  | { ok: true; alreadyPurchased: boolean; result: PurchasedShipEngineLabelResult }
  | { ok: false; error: string; status: number }
> {
  const { supabase, returnId, ownerKey } = params
  const rateId = params.rateId.trim()
  if (!rateId) return { ok: false, error: "Missing ShipEngine rate id.", status: 400 }

  const existing = await getOrderItemReturnById(supabase, returnId)
  if (!existing) return { ok: false, error: "Return not found", status: 404 }
  if (existing.tracking_number?.trim() || returnHasLabelPdf(existing)) {
    return {
      ok: true,
      alreadyPurchased: true,
      result: resultFromExisting({
        trackingNumber: existing.tracking_number,
        trackingCarrier: existing.tracking_carrier,
        labelPdfUrl: existing.label_pdf_url,
        paperlessQrUrl: existing.paperless_qr_url,
        paperlessInstructions: existing.paperless_instructions,
        paperlessHandoffCode: existing.paperless_handoff_code,
        costAmount: existing.label_cost_usd != null ? Number(existing.label_cost_usd) : null,
        costCurrency: existing.label_cost_currency,
      }),
    }
  }

  const lock = await getOrderItemReturnLabelPurchaseLock(supabase, returnId)
  if (lock?.status === "purchased") {
    return {
      ok: true,
      alreadyPurchased: true,
      result: resultFromExisting({
        trackingNumber: lock.tracking_number,
        trackingCarrier: lock.tracking_carrier,
        labelPdfUrl: lock.label_pdf_url,
      }),
    }
  }

  let acquired = false
  if (lock?.status === "failed") {
    acquired = await reclaimFailedOrderItemReturnLabelPurchaseLock({
      supabase,
      returnId,
      ownerKey,
      rateId,
    })
  } else if (!lock) {
    const ins = await insertOrderItemReturnLabelPurchaseLock({
      supabase,
      returnId,
      ownerKey,
      rateId,
    })
    if (!ins.ok) {
      if (ins.conflict) {
        const waited = await waitForPurchasedLock(supabase, returnId)
        if (waited) return { ok: true, alreadyPurchased: true, result: waited }
        return {
          ok: false,
          error: "Return label purchase already in progress. Try again shortly.",
          status: 409,
        }
      }
      return { ok: false, error: ins.error, status: 500 }
    }
    acquired = true
  }

  if (!acquired) {
    const waited = await waitForPurchasedLock(supabase, returnId)
    if (waited) return { ok: true, alreadyPurchased: true, result: waited }
    return {
      ok: false,
      error: "Return label purchase already in progress. Try again shortly.",
      status: 409,
    }
  }

  try {
    const purchased = await purchaseLabelWithRateId(rateId)
    if (!purchased.ok) {
      await markOrderItemReturnLabelPurchaseLockFailed({ supabase, returnId, ownerKey })
      return { ok: false, error: purchased.error, status: purchased.status }
    }

    await markOrderItemReturnLabelPurchaseLockPurchased({
      supabase,
      returnId,
      ownerKey,
      trackingNumber: purchased.result.trackingNumber,
      trackingCarrier: purchased.result.trackingCarrier,
      labelPdfUrl: purchased.result.labelUrl,
      rateId,
    })

    return { ok: true, alreadyPurchased: false, result: purchased.result }
  } catch (e) {
    await markOrderItemReturnLabelPurchaseLockFailed({ supabase, returnId, ownerKey })
    const msg = e instanceof Error ? e.message : "ShipEngine return label purchase failed"
    console.error("[purchaseShipEngineLabelForReturnOnce]", msg)
    return { ok: false, error: msg, status: 502 }
  }
}
