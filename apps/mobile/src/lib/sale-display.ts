import type { MobileSaleListItem } from "@reswell/api-contract"

export type SalesListFilter = "all" | "pending-shipment" | "pending-pickup"

export function saleCountLabel(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return safe === 1 ? "1 sale" : `${safe} sales`
}

export function saleMatchesQuery(
  item: { listing_title: string; buyer_name: string; order_number: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const title = item.listing_title.toLowerCase()
  const buyer = item.buyer_name.toLowerCase()
  const order = item.order_number.toLowerCase()
  return title.includes(q) || buyer.includes(q) || order.includes(q) || `#${order}`.includes(q)
}

export function saleMatchesFilter(item: MobileSaleListItem, filter: SalesListFilter): boolean {
  if (filter === "pending-shipment") return item.pending_kind === "shipment"
  if (filter === "pending-pickup") return item.pending_kind === "pickup"
  return true
}

export function salesFilterEmptyMessage(filter: SalesListFilter): string {
  if (filter === "pending-shipment") return "No open orders are waiting to ship."
  if (filter === "pending-pickup") return "No open orders are waiting for pickup."
  return "No sales match this filter."
}
