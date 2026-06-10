import type { BadgeProps } from "@/components/ui/badge"
import {
  deliveryStatusBadgeVariant,
  deliveryStatusLabel,
  orderStatusBadgeVariant,
  orderStatusIsRefunded,
  orderStatusIsRefundInProgress,
  orderStatusLabel,
} from "@/lib/order-status"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import {
  carrierTrackingDetailIsActionable,
  resolveCarrierStatusHeadline,
  trackingStatusTone,
} from "@/lib/shipping/carrier-status-display"

export type SaleCardStatusDisplay = {
  label: string
  variant: BadgeProps["variant"]
  className?: string
}

export const SHIPPING_LABEL_CREATED_STATUS = "Shipping label created" as const

const FULFILLMENT_COMPLETE_BADGE_CLASS =
  "border-transparent bg-emerald-600 text-white hover:bg-emerald-600"

function fulfillmentCompleteBadgeDisplay(
  deliveryStatus: "delivered" | "picked_up",
): SaleCardStatusDisplay {
  return {
    label: deliveryStatusLabel(deliveryStatus),
    variant: "default",
    className: FULFILLMENT_COMPLETE_BADGE_CLASS,
  }
}

function truncateForBadge(label: string, maxLength = 44): string {
  const trimmed = label.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trim()}…`
}

function carrierBadgeDisplay(detail: OrderTrackingDetail): SaleCardStatusDisplay {
  const tone = trackingStatusTone(detail.status_code)
  return {
    label: truncateForBadge(resolveCarrierStatusHeadline(detail)),
    variant:
      tone === "success" ? "default" : tone === "warning" ? "destructive" : "secondary",
    className:
      tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-600"
        : tone === "warning"
          ? "bg-amber-600 hover:bg-amber-600"
          : undefined,
  }
}

/**
 * Status shown on purchase and sale list cards (and sale detail headers).
 * Refund labels stay authoritative; marketplace delivery confirmation wins over carrier scans.
 */
export function resolveSaleCardStatusDisplay(params: {
  orderStatus: string
  deliveryStatus: string
  trackingNumber: string | null
  trackingDetail: OrderTrackingDetail | null
  hasPreparedShippingLabel?: boolean
}): SaleCardStatusDisplay {
  const { orderStatus, deliveryStatus, trackingNumber, trackingDetail, hasPreparedShippingLabel } =
    params

  if (orderStatusIsRefundInProgress(orderStatus)) {
    return {
      label: orderStatusLabel(orderStatus),
      variant: orderStatusBadgeVariant(orderStatus),
      className: "border-amber-500/40 text-amber-950 dark:text-amber-100",
    }
  }

  if (orderStatusIsRefunded(orderStatus)) {
    return {
      label: orderStatusLabel(orderStatus),
      variant: orderStatusBadgeVariant(orderStatus),
    }
  }

  if (deliveryStatus === "picked_up") {
    return fulfillmentCompleteBadgeDisplay("picked_up")
  }

  if (deliveryStatus === "delivered") {
    return fulfillmentCompleteBadgeDisplay("delivered")
  }

  const hasTracking = !!trackingNumber?.trim()

  if (hasTracking && carrierTrackingDetailIsActionable(trackingDetail)) {
    return carrierBadgeDisplay(trackingDetail)
  }

  if (hasTracking && deliveryStatus === "pending" && hasPreparedShippingLabel) {
    return {
      label: SHIPPING_LABEL_CREATED_STATUS,
      variant: "secondary",
    }
  }

  if (hasTracking && (deliveryStatus === "shipped" || deliveryStatus === "pickup_ready")) {
    return {
      label: deliveryStatusLabel(deliveryStatus),
      variant: deliveryStatusBadgeVariant(deliveryStatus),
    }
  }

  if (hasTracking && deliveryStatus === "pending") {
    return {
      label: deliveryStatusLabel(deliveryStatus),
      variant: deliveryStatusBadgeVariant(deliveryStatus),
    }
  }

  return {
    label: orderStatusLabel(orderStatus),
    variant: orderStatusBadgeVariant(orderStatus),
  }
}
