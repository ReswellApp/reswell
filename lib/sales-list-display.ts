import { orderStatusIsRefunded, orderStatusIsRefundInProgress } from "@/lib/order-status"
import {
  purchaseDetailLine,
  purchaseMatchesQuery,
  type PurchaseStatusTone,
} from "@/lib/purchases-list-display"
import type { ExistingMarketplaceReview } from "@/lib/types/marketplace-review"
import { formatUsd } from "@/lib/utils/format-usd"

export type { PurchaseStatusTone }

/** One row on the sales list. Plain data so the server page can pass it to the client list. */
export interface SaleListItem {
  id: string
  title: string
  imageUrl: string | null
  imageUnoptimized: boolean
  buyerName: string
  detailLine: string
  /** Earnings when the viewer can see payouts, otherwise the sale total. */
  primaryAmount: number
  /** Muted word after the blue amount, such as "earnings". */
  primarySuffix: string | null
  shippingAmount: number
  showShipping: boolean
  amountStruck: boolean
  orderNumber: string
  soldAt: string
  statusLabel: string
  statusTone: PurchaseStatusTone
  refundNote: string | null
  href: string
  needsFulfillment: boolean
  buyerReview: {
    canReview: boolean
    existing: ExistingMarketplaceReview | null
  } | null
}

export function saleCountLabel(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return safe === 1 ? "1 sale" : `${safe} sales`
}

export function saleMatchesQuery(
  item: { title: string; buyerName: string; orderNumber: string },
  query: string,
): boolean {
  return purchaseMatchesQuery(
    { title: item.title, sellerName: item.buyerName, orderNumber: item.orderNumber },
    query,
  )
}

export function saleDetailLine(
  condition: string | null | undefined,
  fulfillmentLabel: string,
  santaBarbaraDropoff: boolean,
): string {
  const base = purchaseDetailLine(condition, fulfillmentLabel)
  if (!santaBarbaraDropoff) return base
  return base ? `${base} · Santa Barbara drop-off` : "Santa Barbara drop-off"
}

export function saleRefundNote(status: string, buyerPaidTotal: number): string | null {
  const amount = formatUsd(Number.isFinite(buyerPaidTotal) ? buyerPaidTotal : 0)
  if (orderStatusIsRefundInProgress(status)) {
    return `Refund in progress — ${amount} returning to the buyer.`
  }
  if (orderStatusIsRefunded(status)) {
    return `Refunded — ${amount} returned to the buyer.`
  }
  return null
}
