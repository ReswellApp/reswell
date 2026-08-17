/**
 * SMS milestones for carrier tracking — used so Klaviyo SMS flows can filter to
 * out-for-delivery / delivered / exception without texting every in-transit scan.
 */

import {
  carrierTrackingIndicatesDelivered,
  latestCarrierEventDescription,
} from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

export type OrderShippingSmsMilestone =
  | "out_for_delivery"
  | "delivered"
  | "exception"

const OUT_FOR_DELIVERY_RE = /out\s+for\s+delivery/i

function trackingTextBlob(detail: OrderTrackingDetail): string {
  const parts = [
    detail.status_description,
    detail.carrier_status_description,
    latestCarrierEventDescription(detail),
  ]
  return parts.filter(Boolean).join(" ")
}

/** Highest-priority milestone present on a tracking snapshot (delivered > exception > OFD). */
export function resolveShippingSmsMilestone(
  detail: OrderTrackingDetail | null | undefined,
): OrderShippingSmsMilestone | null {
  if (!detail) return null

  if (carrierTrackingIndicatesDelivered(detail)) {
    return "delivered"
  }

  const code = (detail.status_code ?? "").trim().toUpperCase()
  if (code === "EX") {
    return "exception"
  }

  if (code === "OF" || OUT_FOR_DELIVERY_RE.test(trackingTextBlob(detail))) {
    return "out_for_delivery"
  }

  return null
}

/**
 * Returns the new SMS milestone only when it first appears (or changes) vs the
 * previous snapshot. Empty transitions / same milestone → null (email still fires).
 */
export function resolveShippingSmsMilestoneTransition(
  previous: OrderTrackingDetail | null | undefined,
  next: OrderTrackingDetail,
): OrderShippingSmsMilestone | null {
  const nextMilestone = resolveShippingSmsMilestone(next)
  if (!nextMilestone) return null

  const previousMilestone = resolveShippingSmsMilestone(previous)
  if (previousMilestone === nextMilestone) return null

  return nextMilestone
}
