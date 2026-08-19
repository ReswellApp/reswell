import type { BadgeProps } from "@/components/ui/badge"
import {
  deliveryStatusBadgeVariant,
  deliveryStatusLabel,
  orderStatusBadgeVariant,
  orderStatusIsRefunded,
  orderStatusIsRefundInProgress,
  orderStatusLabel,
} from "@/lib/order-status"
import {
  saleOpenFulfillmentLabel,
  type SaleFulfillmentFilterInput,
} from "@/lib/sale-fulfillment-filters"
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

const AWAITING_FULFILLMENT_BADGE_CLASS =
  "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"

function awaitingFulfillmentBadge(label: "Awaiting shipment" | "Awaiting pickup"): SaleCardStatusDisplay {
  return {
    label,
    variant: "outline",
    className: AWAITING_FULFILLMENT_BADGE_CLASS,
  }
}

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

export type OrderReturnSummaryForStatus = {
  /** Any non-cancelled return on the order. */
  hasReturn: boolean
  /** True when some but not all line items have a non-cancelled return. */
  isPartial: boolean
  /** True when every non-cancelled return is already refunded. */
  allReturnsRefunded: boolean
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
  returnSummary?: OrderReturnSummaryForStatus | null
  fulfillmentMethod?: string | null
  hasShippingAddress?: boolean
}): SaleCardStatusDisplay {
  const {
    orderStatus,
    deliveryStatus,
    trackingNumber,
    trackingDetail,
    hasPreparedShippingLabel,
    returnSummary,
    fulfillmentMethod,
    hasShippingAddress,
  } = params

  const fulfillmentInput: SaleFulfillmentFilterInput = {
    fulfillmentMethod: fulfillmentMethod ?? null,
    deliveryStatus,
    orderStatus,
    hasShippingAddress: Boolean(hasShippingAddress),
    hasPreparedShippingLabel: Boolean(hasPreparedShippingLabel),
  }

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

  if (returnSummary?.hasReturn) {
    if (returnSummary.allReturnsRefunded && !returnSummary.isPartial) {
      return {
        label: "Returned",
        variant: "destructive",
      }
    }
    if (returnSummary.isPartial) {
      return {
        label: returnSummary.allReturnsRefunded ? "Partial refund" : "Partial return",
        variant: "outline",
        className: "border-amber-500/40 text-amber-950 dark:text-amber-100",
      }
    }
    return {
      label: "Returned",
      variant: "outline",
      className: "border-amber-500/40 text-amber-950 dark:text-amber-100",
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

  const hasFulfillmentContext = fulfillmentMethod != null || hasShippingAddress === true
  if (hasFulfillmentContext) {
    const awaitingLabel = saleOpenFulfillmentLabel(fulfillmentInput)
    if (awaitingLabel) {
      return awaitingFulfillmentBadge(awaitingLabel)
    }
  } else if (deliveryStatus === "pending") {
    return awaitingFulfillmentBadge("Awaiting shipment")
  } else if (deliveryStatus === "pickup_ready") {
    return awaitingFulfillmentBadge("Awaiting pickup")
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
