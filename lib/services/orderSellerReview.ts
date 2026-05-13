/**
 * Marketplace order reviews: eligibility for leaving a rating after fulfillment.
 * Applies to buyer→seller reviews and seller→buyer reviews (same delivery gate).
 */
type OrderRow = {
  status: string
  delivery_status: string
}

/** Buyer may rate the seller after the item is received (delivered or pickup completed). */
export function canSubmitSellerReview(order: OrderRow): boolean {
  if (order.status !== "confirmed") return false
  return order.delivery_status === "delivered" || order.delivery_status === "picked_up"
}

export function validateSellerReviewForOrder(
  order: OrderRow,
): { ok: true } | { ok: false; error: string } {
  if (order.status === "refunded" || order.status === "refunding") {
    return { ok: false, error: "Reviews are not available for refunded orders." }
  }
  if (!canSubmitSellerReview(order)) {
    return {
      ok: false,
      error:
        "You can review the seller after you’ve received the item — when delivery shows as delivered, or pickup is completed.",
    }
  }
  return { ok: true }
}
