import type { OrderReturnSummaryForStatus } from "@/lib/sale-card-status"

const DELIVERY_COMPLETE = new Set(["delivered", "picked_up"])

export type OrderPayoutReleaseState = {
  status: string
  released_at?: string | null
}

export type ClosureOrderAttention = {
  orderStatus: string
  deliveryStatus: string
  /** True once seller earnings have left the hold and can be cashed out. */
  payoutReleased: boolean
  returnInProgress: boolean
}

export function deliveryStillNeedsAttention(deliveryStatus: string): boolean {
  return !DELIVERY_COMPLETE.has(deliveryStatus)
}

/**
 * Funds are released when the payout has left `held`.
 * A legacy `pending` row with no `released_at` is still on hold.
 */
export function payoutFundsAreReleased(
  payout: OrderPayoutReleaseState | null | undefined,
): boolean {
  if (!payout) return false
  if (payout.status === "paid" || payout.status === "processing") return true
  if (payout.status === "pending") return Boolean(payout.released_at?.trim())
  return false
}

export function returnStillOpen(
  summary: OrderReturnSummaryForStatus | null | undefined,
): boolean {
  return Boolean(summary?.hasReturn && !summary.allReturnsRefunded)
}

/**
 * Seller still needs the sale: it is not delivered, earnings are not released,
 * or a return or refund is still open.
 */
export function saleNeedsClosureAttention(input: ClosureOrderAttention): boolean {
  if (input.orderStatus === "refunded") return false
  if (input.orderStatus === "refunding") return true
  if (input.returnInProgress) return true
  if (deliveryStillNeedsAttention(input.deliveryStatus)) return true
  return !input.payoutReleased
}

/**
 * Buyer still needs the purchase for delivery, or while a return or refund is open.
 * Cash-out lives on the seller's earnings page.
 */
export function purchaseNeedsClosureAttention(input: ClosureOrderAttention): boolean {
  if (input.orderStatus === "refunded") return false
  if (input.orderStatus === "refunding") return true
  if (input.returnInProgress) return true
  return deliveryStillNeedsAttention(input.deliveryStatus)
}
