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
 * Delivered is already stored on the order (`delivery_status`, `carrier_delivered_at`).
 * The delivered text is stamped on `orders.buyer_notified_delivered_at` when it sends.
 * Out for delivery and exception are already stored on the previous tracking snapshot.
 * A refresh that does not change that milestone is not a new message.
 * Ordinary in-transit scans email only from a carrier writer (webhook or cron).
 */
export function planOrderShippingNotification(input: {
  previous: OrderTrackingDetail | null | undefined
  next: OrderTrackingDetail
  /** True when the order was already marked delivered before this refresh. */
  deliveryAlreadyRecorded: boolean
  notifyScanUpdates: boolean
}): OrderShippingNotifyPlan {
  if (input.deliveryAlreadyRecorded) return { kind: "skip" }

  const nextMilestone = resolveShippingSmsMilestone(input.next)
  const previousMilestone = resolveShippingSmsMilestone(input.previous)

  if (nextMilestone) {
    if (previousMilestone === nextMilestone) return { kind: "skip" }
    return { kind: "milestone", milestone: nextMilestone }
  }

  if (!input.notifyScanUpdates) return { kind: "skip" }
  if (!orderTrackingUpdateChanged(input.previous, input.next)) return { kind: "skip" }
  return { kind: "scan" }
}
