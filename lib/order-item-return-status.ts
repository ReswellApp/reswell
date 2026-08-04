import type { BadgeProps } from "@/components/ui/badge"

export const ORDER_ITEM_RETURN_STATUS_LIST = [
  "authorized",
  "in_transit",
  "delivered",
  "refund_pending",
  "refunded",
  "cancelled",
] as const

export type OrderItemReturnStatus = (typeof ORDER_ITEM_RETURN_STATUS_LIST)[number]

export function isOrderItemReturnStatus(value: string): value is OrderItemReturnStatus {
  return (ORDER_ITEM_RETURN_STATUS_LIST as readonly string[]).includes(value)
}

/** True while the return is open (buyer still has / needs the return label). */
export function orderItemReturnIsOpen(status: string): boolean {
  return (
    status === "authorized" ||
    status === "in_transit" ||
    status === "delivered" ||
    status === "refund_pending"
  )
}

export function orderItemReturnIsRefunded(status: string): boolean {
  return status === "refunded"
}

export function orderItemReturnLabel(status: string): string {
  switch (status) {
    case "authorized":
      return "Returned"
    case "in_transit":
      return "Return in transit"
    case "delivered":
      return "Return delivered"
    case "refund_pending":
      return "Refund pending"
    case "refunded":
      return "Refunded"
    case "cancelled":
      return "Return cancelled"
    default:
      return status
  }
}

export function orderItemReturnBadgeVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "refunded":
      return "destructive"
    case "delivered":
    case "refund_pending":
      return "secondary"
    case "in_transit":
    case "authorized":
      return "outline"
    case "cancelled":
      return "outline"
    default:
      return "outline"
  }
}

/** 24h hold after return carrier delivery before auto item refund (mirrors payout hold). */
export const RETURN_DELIVERY_REFUND_HOLD_MS = 24 * 60 * 60 * 1000
