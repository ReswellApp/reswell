import { createServiceRoleClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { RETURN_DELIVERY_REFUND_HOLD_MS } from "@/lib/order-item-return-status"
import { getOrderItemReturnById } from "@/lib/db/orderItemReturns"
import { issueOrderItemReturnRefund } from "@/lib/services/issueOrderItemReturnRefund"

const BATCH_LIMIT = 50
const MAX_BATCHES = 10

export type AutoRefundAfterReturnSummary = {
  scanned: number
  refunded: number
  skipped: number
  errors: string[]
}

function holdElapsed(carrierDeliveredAt: string | null | undefined, referenceTime: Date): boolean {
  if (!carrierDeliveredAt) return false
  const deliveredMs = Date.parse(carrierDeliveredAt)
  if (!Number.isFinite(deliveredMs)) return false
  return referenceTime.getTime() - deliveredMs >= RETURN_DELIVERY_REFUND_HOLD_MS
}

/**
 * Issues the item refund when return carrier delivery was recorded at least 24h ago.
 * Idempotent via return status + stripe/wallet reference uniqueness.
 */
export async function tryRefundOrderItemReturnAfterCarrierHold(
  returnId: string,
  referenceTime: Date = new Date(),
  serviceSupabase?: SupabaseClient,
): Promise<{ refunded: boolean; error?: string }> {
  let supabase = serviceSupabase
  if (!supabase) {
    try {
      supabase = createServiceRoleClient()
    } catch (e) {
      console.error("[autoRefundAfterReturn] service client:", e)
      return { refunded: false, error: "Server configuration error" }
    }
  }

  const row = await getOrderItemReturnById(supabase, returnId)
  if (!row) return { refunded: false, error: "Return not found" }

  if (row.status === "refunded" || row.refunded_at) {
    return { refunded: false }
  }

  if (row.status !== "delivered" && row.status !== "refund_pending") {
    return { refunded: false }
  }

  if (!holdElapsed(row.carrier_delivered_at, referenceTime)) {
    return { refunded: false }
  }

  const result = await issueOrderItemReturnRefund(supabase, returnId)
  if (!result.ok) {
    return { refunded: false, error: result.error }
  }
  return { refunded: true }
}

export async function autoRefundAfterReturnDelivered(
  referenceTime: Date = new Date(),
): Promise<AutoRefundAfterReturnSummary> {
  const summary: AutoRefundAfterReturnSummary = {
    scanned: 0,
    refunded: 0,
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

  const cutoffIso = new Date(referenceTime.getTime() - RETURN_DELIVERY_REFUND_HOLD_MS).toISOString()

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data: rows, error } = await supabase
      .from("order_item_returns")
      .select("id")
      .in("status", ["delivered", "refund_pending"])
      .not("carrier_delivered_at", "is", null)
      .lte("carrier_delivered_at", cutoffIso)
      .is("refunded_at", null)
      .order("carrier_delivered_at", { ascending: true })
      .limit(BATCH_LIMIT)

    if (error) {
      summary.errors.push(error.message)
      return summary
    }

    const ids = (rows ?? []).map((r) => (r as { id: string }).id)
    if (ids.length === 0) break

    summary.scanned += ids.length

    for (const returnId of ids) {
      const attempt = await tryRefundOrderItemReturnAfterCarrierHold(
        returnId,
        referenceTime,
        supabase,
      )
      if (attempt.refunded) {
        summary.refunded += 1
      } else if (attempt.error) {
        summary.errors.push(`${returnId}: ${attempt.error}`)
      } else {
        summary.skipped += 1
      }
    }

    if (ids.length < BATCH_LIMIT) break
  }

  return summary
}
