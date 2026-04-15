import type { OrderBuyerSupportRequestInput } from "@/lib/validations/order-buyer-support"

type OrderRow = {
  status: string
  delivery_status: string
  fulfillment_method: string | null
}

export function canSubmitCancelRequest(order: OrderRow): boolean {
  if (order.status !== "confirmed") return false
  if (order.fulfillment_method === "shipping") {
    return order.delivery_status === "pending"
  }
  if (order.fulfillment_method === "pickup") {
    return order.delivery_status === "pending" || order.delivery_status === "pickup_ready"
  }
  return order.delivery_status === "pending"
}

export function canSubmitRefundHelpRequest(order: OrderRow): boolean {
  return order.status === "confirmed"
}

export function validateBuyerSupportForOrder(
  order: OrderRow,
  input: OrderBuyerSupportRequestInput,
): { ok: true } | { ok: false; error: string } {
  if (input.request_type === "cancel_order" && !canSubmitCancelRequest(order)) {
    return {
      ok: false,
      error:
        "Cancellation requests are only available before this order ships or before pickup is completed. Contact support if you need help.",
    }
  }
  if (input.request_type === "refund_help") {
    if (order.status === "refunded") {
      return { ok: false, error: "This order is already refunded." }
    }
    if (order.status === "refunding") {
      return {
        ok: false,
        error: "A refund is already in progress for this order. Check back shortly or contact support if it does not complete.",
      }
    }
    if (!canSubmitRefundHelpRequest(order)) {
      return { ok: false, error: "Refund help is not available for this order state." }
    }
  }
  return { ok: true }
}
