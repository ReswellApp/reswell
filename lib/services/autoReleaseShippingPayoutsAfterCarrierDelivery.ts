import { createServiceRoleClient } from "@/lib/supabase/server"
import { carrierDeliveryPayoutHoldElapsed, CARRIER_DELIVERY_PAYOUT_HOLD_MS } from "@/lib/shipping/carrier-delivery-payout-hold"
import { markShippingDeliveredAndReleaseSellerEarnings } from "@/lib/services/shippingDeliveredFinalize"

const BATCH_LIMIT = 50

export type AutoReleaseCarrierPayoutSummary = {
  scanned: number
  released: number
  skipped: number
  errors: string[]
}

/**
 * Credits seller wallet when carrier delivery was recorded at least 24h ago.
 * Idempotent per order via shippingDeliveredFinalize + wallet RPC.
 */
export async function tryReleaseShippingPayoutAfterCarrierHold(
  orderId: string,
  referenceTime: Date = new Date(),
): Promise<{ released: boolean; error?: string }> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[autoReleaseCarrierPayout] service client:", e)
    return { released: false, error: "Server configuration error" }
  }

  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status, fulfillment_method, carrier_delivered_at")
    .eq("id", orderId)
    .maybeSingle()

  if (fetchErr || !row) {
    return { released: false, error: "Order not found" }
  }

  const order = row as {
    status: string
    fulfillment_method: string | null
    carrier_delivered_at: string | null
  }

  if (order.status !== "confirmed" || order.fulfillment_method !== "shipping") {
    return { released: false }
  }

  if (!carrierDeliveryPayoutHoldElapsed(order.carrier_delivered_at, referenceTime)) {
    return { released: false }
  }

  const result = await markShippingDeliveredAndReleaseSellerEarnings(orderId)
  if (!result.ok) {
    return { released: false, error: result.error }
  }

  return { released: result.walletReleasedNew }
}

export async function autoReleaseShippingPayoutsAfterCarrierDelivery(
  referenceTime: Date = new Date(),
): Promise<AutoReleaseCarrierPayoutSummary> {
  const summary: AutoReleaseCarrierPayoutSummary = {
    scanned: 0,
    released: 0,
    skipped: 0,
    errors: [],
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    summary.errors.push(e instanceof Error ? e.message : "Missing service role client")
    return summary
  }

  const cutoffIso = new Date(
    referenceTime.getTime() - CARRIER_DELIVERY_PAYOUT_HOLD_MS,
  ).toISOString()

  const { data: rows, error } = await supabase
    .from("orders")
    .select("id")
    .eq("fulfillment_method", "shipping")
    .eq("status", "confirmed")
    .not("carrier_delivered_at", "is", null)
    .lte("carrier_delivered_at", cutoffIso)
    .order("carrier_delivered_at", { ascending: true })
    .limit(BATCH_LIMIT)

  if (error) {
    summary.errors.push(error.message)
    return summary
  }

  const ids = (rows ?? []).map((r) => (r as { id: string }).id)
  summary.scanned = ids.length

  for (const orderId of ids) {
    const attempt = await tryReleaseShippingPayoutAfterCarrierHold(orderId, referenceTime)
    if (attempt.released) {
      summary.released += 1
    } else if (attempt.error) {
      summary.errors.push(`${orderId}: ${attempt.error}`)
    } else {
      summary.skipped += 1
    }
  }

  return summary
}
