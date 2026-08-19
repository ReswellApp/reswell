import { orderStatusLocksDuringRefund } from "@/lib/order-status"

export const SALES_LIST_FILTERS = ["all", "pending-shipment", "pending-pickup"] as const
export type SalesListFilter = (typeof SALES_LIST_FILTERS)[number]

export type SaleFulfillmentFilterInput = {
  fulfillmentMethod: string | null
  deliveryStatus: string
  orderStatus: string
  hasShippingAddress: boolean
  hasPreparedShippingLabel: boolean
}

export function parseSalesListFilter(raw: string | undefined): SalesListFilter {
  if (raw === "pending-shipment" || raw === "pending-pickup") return raw
  return "all"
}

export function saleIsShippingFulfillment(input: SaleFulfillmentFilterInput): boolean {
  return input.fulfillmentMethod === "shipping" || input.hasShippingAddress
}

export function saleIsOpenForFulfillment(input: SaleFulfillmentFilterInput): boolean {
  return !orderStatusLocksDuringRefund(input.orderStatus)
}

/** Ship-to-buyer sale that still needs to leave the seller. */
export function saleIsPendingShipment(input: SaleFulfillmentFilterInput): boolean {
  if (!saleIsOpenForFulfillment(input)) return false
  if (!saleIsShippingFulfillment(input)) return false
  return input.deliveryStatus === "pending"
}

/** Local-pickup sale that has not been handed off yet. */
export function saleIsPendingPickup(input: SaleFulfillmentFilterInput): boolean {
  if (!saleIsOpenForFulfillment(input)) return false
  if (saleIsShippingFulfillment(input)) return false
  return input.deliveryStatus === "pending" || input.deliveryStatus === "pickup_ready"
}

/** Sold and still waiting for the seller to ship or hand off. */
export function saleNeedsFulfillment(input: SaleFulfillmentFilterInput): boolean {
  return saleIsPendingShipment(input) || saleIsPendingPickup(input)
}

export function saleOpenFulfillmentLabel(
  input: SaleFulfillmentFilterInput,
): "Awaiting shipment" | "Awaiting pickup" | null {
  if (saleIsPendingShipment(input)) return "Awaiting shipment"
  if (saleIsPendingPickup(input)) return "Awaiting pickup"
  return null
}

/** Open fulfillment first, then newest within each group. */
export function compareSalesForSellerList(
  a: { createdAt: string; filterInput: SaleFulfillmentFilterInput },
  b: { createdAt: string; filterInput: SaleFulfillmentFilterInput },
): number {
  const aOpen = saleNeedsFulfillment(a.filterInput)
  const bOpen = saleNeedsFulfillment(b.filterInput)
  if (aOpen !== bOpen) return aOpen ? -1 : 1
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

/** Open shipment with a carrier label ready to print. */
export function saleHasPrintableOpenLabel(input: SaleFulfillmentFilterInput): boolean {
  return saleIsPendingShipment(input) && input.hasPreparedShippingLabel
}

export function saleMatchesListFilter(
  input: SaleFulfillmentFilterInput,
  filter: SalesListFilter,
): boolean {
  if (filter === "pending-shipment") return saleIsPendingShipment(input)
  if (filter === "pending-pickup") return saleIsPendingPickup(input)
  return true
}
