import { formatCondition } from "@/lib/listing-labels"
import { orderStatusIsRefunded, orderStatusIsRefundInProgress } from "@/lib/order-status"
import type { ExistingMarketplaceReview } from "@/lib/types/marketplace-review"
import { formatUsd } from "@/lib/utils/format-usd"

export type PurchaseStatusTone = "success" | "warning" | "danger" | "neutral"

/** One row on the purchases list. Plain data so the server page can pass it to the client list. */
export interface PurchaseListItem {
  id: string
  title: string
  imageUrl: string | null
  imageUnoptimized: boolean
  sellerName: string
  detailLine: string
  itemAmount: number
  shippingAmount: number
  showShipping: boolean
  amountStruck: boolean
  orderNumber: string
  purchasedAt: string
  statusLabel: string
  statusTone: PurchaseStatusTone
  refundNote: string | null
  href: string
  sellerReview: {
    canReview: boolean
    existing: ExistingMarketplaceReview | null
  } | null
}

export function purchaseCountLabel(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return safe === 1 ? "1 purchase" : `${safe} purchases`
}

export function purchaseMatchesQuery(
  item: { title: string; sellerName: string; orderNumber: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const title = item.title.toLowerCase()
  const seller = item.sellerName.toLowerCase()
  const order = item.orderNumber.toLowerCase()
  return title.includes(q) || seller.includes(q) || order.includes(q) || `#${order}`.includes(q)
}

/** Buyer total is item price plus shipping. Clamp so a bad shipping figure cannot go negative. */
export function splitPurchaseAmount(
  amount: number,
  shippingAmount: number,
): { itemAmount: number; shippingAmount: number } {
  const total = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const shipping = Number.isFinite(shippingAmount) ? Math.max(0, shippingAmount) : 0
  const shippingCapped = Math.min(shipping, total)
  const itemAmount = Math.round((total - shippingCapped) * 100) / 100
  return {
    itemAmount,
    shippingAmount: Math.round(shippingCapped * 100) / 100,
  }
}

/**
 * Secondary line under the seller. Condition stands in for format (e.g. Hardcover).
 * Pickup stays visible when a condition is present, because there is no shipping addendum.
 */
export function purchaseDetailLine(
  condition: string | null | undefined,
  fulfillmentLabel: string,
): string {
  const conditionLabel = formatCondition(condition).trim()
  const fulfillment = fulfillmentLabel.trim()
  if (conditionLabel && fulfillment === "Local pickup") {
    return `${conditionLabel} · Local pickup`
  }
  if (conditionLabel) return conditionLabel
  return fulfillment
}

export function purchaseShowsShipping(fulfillmentLabel: string, shippingAmount: number): boolean {
  if (shippingAmount > 0) return true
  return fulfillmentLabel.trim() !== "Local pickup"
}

export function purchaseRefundNote(status: string, totalAmount: number): string | null {
  const amount = formatUsd(Number.isFinite(totalAmount) ? totalAmount : 0)
  if (orderStatusIsRefundInProgress(status)) {
    return `Refund in progress — ${amount} is on its way back.`
  }
  if (orderStatusIsRefunded(status)) {
    return `Refunded — ${amount} returned to you.`
  }
  return null
}

export function purchaseStatusTone(input: {
  label: string
  variant?: string | null
  className?: string | null
}): PurchaseStatusTone {
  const className = input.className ?? ""
  const label = input.label.trim().toLowerCase()

  if (className.includes("emerald") || label === "delivered" || label === "picked up") {
    return "success"
  }
  if (input.variant === "destructive" || label === "refunded" || label === "returned") {
    return "danger"
  }
  if (
    className.includes("amber") ||
    label.includes("awaiting") ||
    label.includes("refund") ||
    label.includes("partial") ||
    label === "canceled" ||
    label === "cancelled"
  ) {
    return "warning"
  }
  if (input.variant === "secondary") return "neutral"
  return "warning"
}
