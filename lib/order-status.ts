import type { BadgeProps } from "@/components/ui/badge"

// ── Order status ──────────────────────────────────────────────

export const ORDER_STATUS_LIST = ["pending", "confirmed", "refunded"] as const
export type OrderStatus = (typeof ORDER_STATUS_LIST)[number]

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUS_LIST as readonly string[]).includes(value)
}

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "confirmed":
      return "Confirmed"
    case "refunded":
      return "Refunded"
    default:
      return status
  }
}

export function orderStatusBadgeVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "confirmed":
      return "secondary"
    case "pending":
      return "outline"
    case "refunded":
      return "destructive"
    default:
      return "outline"
  }
}

// ── Delivery status ───────────────────────────────────────────

export const DELIVERY_STATUS_LIST = [
  "pending",
  "shipped",
  "delivered",
  "pickup_ready",
  "picked_up",
] as const

export type DeliveryStatus = (typeof DELIVERY_STATUS_LIST)[number]

export function deliveryStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Awaiting shipment"
    case "shipped":
      return "Shipped"
    case "delivered":
      return "Delivered"
    case "pickup_ready":
      return "Ready for pickup"
    case "picked_up":
      return "Picked up"
    default:
      return status
  }
}

export function deliveryStatusBadgeVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "delivered":
    case "picked_up":
      return "default"
    case "shipped":
    case "pickup_ready":
      return "secondary"
    case "pending":
      return "outline"
    default:
      return "outline"
  }
}

// ── Payout status ─────────────────────────────────────────────

export function payoutStatusLabel(status: string, holdReason?: string | null): string {
  if (status === "held") {
    switch (holdReason) {
      case "awaiting_shipment":
        return "Held — add tracking"
      case "awaiting_delivery":
        return "Held — awaiting delivery"
      case "awaiting_pickup":
        return "Held — awaiting pickup"
      default:
        return "Held"
    }
  }
  switch (status) {
    case "pending":
      return "Available for payout"
    case "processing":
      return "Payout processing"
    case "paid":
      return "Paid out"
    case "failed":
      return "Payout failed"
    case "cancelled":
      return "Payout cancelled"
    default:
      return status
  }
}

export function payoutStatusBadgeVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "held":
      return "outline"
    case "pending":
      return "secondary"
    case "paid":
      return "default"
    case "failed":
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

// ── Pickup code ───────────────────────────────────────────────

export function generatePickupCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
