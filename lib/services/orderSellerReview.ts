import { carrierTrackingIndicatesDelivered } from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

/**
 * Marketplace order reviews: eligibility for leaving a rating after fulfillment.
 * Applies to buyer→seller reviews and seller→buyer reviews (same delivery gate).
 */
type OrderRow = {
  status: string
  delivery_status: string
}

export function orderFulfillmentCompleteForReview(
  order: OrderRow,
  trackingDetail?: OrderTrackingDetail | null,
): boolean {
  if (order.status !== "confirmed") return false
  if (order.delivery_status === "delivered" || order.delivery_status === "picked_up") {
    return true
  }
  return carrierTrackingIndicatesDelivered(trackingDetail)
}

/** Buyer may rate the seller after the item is received (delivered or pickup completed). */
export function canSubmitSellerReview(
  order: OrderRow,
  trackingDetail?: OrderTrackingDetail | null,
): boolean {
  return orderFulfillmentCompleteForReview(order, trackingDetail)
}

export function validateSellerReviewForOrder(
  order: OrderRow,
  trackingDetail?: OrderTrackingDetail | null,
): { ok: true } | { ok: false; error: string } {
  if (order.status === "refunded" || order.status === "refunding") {
    return { ok: false, error: "Reviews are not available for refunded orders." }
  }
  if (!canSubmitSellerReview(order, trackingDetail)) {
    return {
      ok: false,
      error:
        "You can leave a review after the item is delivered — when carrier tracking shows delivery, or pickup is completed.",
    }
  }
  return { ok: true }
}
