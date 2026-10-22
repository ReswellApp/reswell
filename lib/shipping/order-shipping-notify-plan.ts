import type { OrderShippingSmsMilestone } from "@/lib/shipping/order-shipping-sms-milestone"
import { resolveShippingSmsMilestone } from "@/lib/shipping/order-shipping-sms-milestone"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { orderTrackingUpdateChanged } from "@/lib/shipping/order-tracking-update-key"

export type OrderShippingNotifyPlan =
  | { kind: "milestone"; milestone: OrderShippingSmsMilestone }
  | { kind: "scan" }
  | { kind: "skip" }

/**
 * What a tracking writer may tell the buyer.
 *
 * Milestones (out for delivery, delivered, exception) send once per order.
 * Delivery ends the thread: a later "out for delivery" wording does not text.
 * Ordinary in-transit scans email only from a carrier writer (webhook or cron),
 * and only when the scan itself changed. Opening a purchase is not a carrier writer.
 */
export function planOrderShippingNotification(input: {
  previous: OrderTrackingDetail | null | undefined
  next: OrderTrackingDetail
  claimedMilestones: ReadonlySet<OrderShippingSmsMilestone>
  notifyScanUpdates: boolean
}): OrderShippingNotifyPlan {
  const milestone = resolveShippingSmsMilestone(input.next)
  const deliveredClaimed = input.claimedMilestones.has("delivered")

  if (deliveredClaimed && milestone !== "delivered") {
    return { kind: "skip" }
  }

  if (milestone) {
    if (input.claimedMilestones.has(milestone)) return { kind: "skip" }
    return { kind: "milestone", milestone }
  }

  if (!input.notifyScanUpdates) return { kind: "skip" }
  if (deliveredClaimed) return { kind: "skip" }
  if (!orderTrackingUpdateChanged(input.previous, input.next)) return { kind: "skip" }
  return { kind: "scan" }
}
