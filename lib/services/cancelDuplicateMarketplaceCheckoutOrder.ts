import type { SupabaseClient } from "@supabase/supabase-js"
import {
  issueMarketplaceOrderRefund,
  type MarketplaceOrderRefundRow,
} from "@/lib/services/issueMarketplaceOrderRefund"
import { emitKlaviyoOrderRefundedForOrder } from "@/lib/services/klaviyoOrderRefunded"

const ORDER_SELECT =
  "id, order_num, seller_id, buyer_id, listing_id, amount, seller_earnings, status, payment_method, stripe_checkout_session_id, refund_disposition, fulfillment_method, delivery_status"

type OrderRow = MarketplaceOrderRefundRow & {
  order_num: string | null
  fulfillment_method: string | null
  delivery_status: string | null
}

export type CancelDuplicateMarketplaceCheckoutOrderResult =
  | {
      ok: true
      canceledOrderId: string
      canceledOrderNum: string | null
      keptOrderId: string
      keptOrderNum: string | null
      listingId: string
      refund: {
        refund_type: "stripe" | "wallet"
        disposition: string
        fullyRefundedInApp: boolean
        message: string
        labelVoid: unknown
      }
      listingStatusAfter: string | null
      keptOrderStatusAfter: string | null
    }
  | { ok: false; error: string; status: number }

/**
 * Refund one duplicate checkout while leaving a sibling live order + shared listing alone.
 * Uses `cancel_unshipped` (void unused outbound label + full buyer refund). Relist is skipped
 * when the keeper order still holds an open checkout (see listingRelist guard).
 */
export async function cancelDuplicateMarketplaceCheckoutOrder(
  supabase: SupabaseClient,
  params: {
    cancelOrderId: string
    keepOrderId: string
  },
): Promise<CancelDuplicateMarketplaceCheckoutOrderResult> {
  const cancelOrderId = params.cancelOrderId.trim()
  const keepOrderId = params.keepOrderId.trim()

  if (!cancelOrderId || !keepOrderId) {
    return { ok: false, error: "cancelOrderId and keepOrderId are required", status: 400 }
  }
  if (cancelOrderId === keepOrderId) {
    return { ok: false, error: "cancelOrderId and keepOrderId must be different", status: 400 }
  }

  const [{ data: cancelRow, error: cancelErr }, { data: keepRow, error: keepErr }] =
    await Promise.all([
      supabase.from("orders").select(ORDER_SELECT).eq("id", cancelOrderId).maybeSingle(),
      supabase.from("orders").select(ORDER_SELECT).eq("id", keepOrderId).maybeSingle(),
    ])

  if (cancelErr || keepErr) {
    console.error("[cancel duplicate checkout] load orders", { cancelErr, keepErr })
    return { ok: false, error: "Could not load orders", status: 502 }
  }
  if (!cancelRow || !keepRow) {
    return { ok: false, error: "One or both orders were not found", status: 404 }
  }

  const cancelOrder = cancelRow as OrderRow
  const keepOrder = keepRow as OrderRow

  if (!cancelOrder.listing_id || cancelOrder.listing_id !== keepOrder.listing_id) {
    return {
      ok: false,
      error: "Orders must share the same listing_id (duplicate checkout pair)",
      status: 400,
    }
  }

  if (keepOrder.status !== "confirmed" && keepOrder.status !== "refunding") {
    return {
      ok: false,
      error: `Keeper order is "${keepOrder.status}" — refuse to cancel the duplicate while the live order is not open`,
      status: 409,
    }
  }

  if (cancelOrder.status === "refunded") {
    return { ok: false, error: "Duplicate order is already refunded", status: 409 }
  }

  if (cancelOrder.status !== "confirmed" && cancelOrder.status !== "refunding") {
    return {
      ok: false,
      error: `Duplicate order status is "${cancelOrder.status}" — only confirmed/refunding can be cancelled`,
      status: 400,
    }
  }

  const result = await issueMarketplaceOrderRefund(supabase, cancelOrder, {
    disposition: cancelOrder.status === "refunding" ? undefined : "cancel_unshipped",
  })

  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status }
  }

  if (result.fullyRefundedInApp) {
    await emitKlaviyoOrderRefundedForOrder(supabase, cancelOrderId, {
      refundType: result.refund_type,
      source: "admin",
    })
  }

  const [{ data: listingAfter }, { data: keepAfter }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, status, hidden_from_site")
      .eq("id", cancelOrder.listing_id)
      .maybeSingle(),
    supabase.from("orders").select("id, status").eq("id", keepOrderId).maybeSingle(),
  ])

  const listingStatus = (listingAfter as { status?: string } | null)?.status ?? null
  const keepStatus = (keepAfter as { status?: string } | null)?.status ?? null

  if (keepStatus !== "confirmed" && keepStatus !== "refunding") {
    console.error("[cancel duplicate checkout] keeper order status changed unexpectedly", {
      keepOrderId,
      keepStatus,
    })
  }
  if (listingStatus && listingStatus !== "sold") {
    console.error("[cancel duplicate checkout] listing left sold unexpectedly — restoring", {
      listingId: cancelOrder.listing_id,
      listingStatus,
      keepOrderId,
    })
    const nowIso = new Date().toISOString()
    await supabase
      .from("listings")
      .update({
        status: "sold",
        hidden_from_site: false,
        site_visibility_reason: null,
        updated_at: nowIso,
      })
      .eq("id", cancelOrder.listing_id)
  }

  const { data: listingFinal } = await supabase
    .from("listings")
    .select("status")
    .eq("id", cancelOrder.listing_id)
    .maybeSingle()

  return {
    ok: true,
    canceledOrderId: cancelOrder.id,
    canceledOrderNum: cancelOrder.order_num,
    keptOrderId: keepOrder.id,
    keptOrderNum: keepOrder.order_num,
    listingId: cancelOrder.listing_id,
    refund: {
      refund_type: result.refund_type,
      disposition: result.disposition,
      fullyRefundedInApp: result.fullyRefundedInApp,
      message: result.message,
      labelVoid: result.labelVoid,
    },
    listingStatusAfter: (listingFinal as { status?: string } | null)?.status ?? listingStatus,
    keptOrderStatusAfter: keepStatus,
  }
}
