/**
 * Buyer notification policy for carrier tracking.
 *
 * Email and SMS both listen to the Klaviyo metric **Order Shipping Update**.
 * Routine hops used to emit that metric, which is why buyers got a message for
 * every "Arrived at USPS Facility" / "Departed USPS Facility" / "Arrived at
 * Post Office" scan — often twice.
 *
 * Emit only when the snapshot is a new buyer-relevant milestone:
 * - out for delivery (once per calendar day)
 * - delivery attempt (once per calendar day)
 * - available for pickup / notice left (once per calendar day)
 * - exception, once per reason (return to sender, address problem, …)
 * - delivered (once per order)
 *
 * SMS keeps the existing Klaviyo values `out_for_delivery`, `delivered`, and
 * `exception`. Attempts and pickup holds map to `exception` so a flow filtered
 * on those three values still texts the buyer when they need to act.
 * `notification_kind` carries the finer reason.
 */

import {
  carrierTrackingIndicatesDelivered,
  latestCarrierEventDescription,
} from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { orderTrackingUpdateChanged } from "@/lib/shipping/order-tracking-update-key"

export type OrderShippingSmsMilestone =
  | "out_for_delivery"
  | "delivered"
  | "exception"

export type ShippingNotificationKind =
  | "out_for_delivery"
  | "delivered"
  | "delivery_attempt"
  | "available_for_pickup"
  | "exception"

export type ShippingUpdateNotification = {
  kind: ShippingNotificationKind
  smsMilestone: OrderShippingSmsMilestone
  dedupeKey: string
}

const OUT_FOR_DELIVERY_RE =
  /\b(?:out\s+for\s+delivery|on\s+(?:[a-z]+\s+)?vehicle\s+for\s+delivery|loaded\s+on\s+delivery\s+vehicle|with\s+delivery\s+courier)\b/i

/** Buyer has to go get the package. "Arrived at Post Office" is a transit hop, not this. */
const AVAILABLE_FOR_PICKUP_RE =
  /\b(?:available for pickup|ready for pickup|pickup available|held for pickup|hold for pickup|notice left|awaiting pickup|customer pickup|access point|hold at location|held at location|held at post office)\b/i

const DELIVERY_ATTEMPT_RE =
  /\b(?:delivery attempted|attempted delivery|delivery attempt|missed delivery|no access to delivery|business closed|no authorized recipient)\b/i

const EXCEPTION_REASONS: ReadonlyArray<{ pattern: RegExp; slug: string }> = [
  { pattern: /\breturn(?:ed)? to sender\b/i, slug: "return-to-sender" },
  { pattern: /\bundeliverable\b/i, slug: "undeliverable" },
  { pattern: /\baddressee unknown\b/i, slug: "addressee-unknown" },
  { pattern: /\b(?:insufficient|incorrect|incomplete) address\b/i, slug: "address-problem" },
  { pattern: /\b(?:package|shipment) damaged\b/i, slug: "damaged" },
  { pattern: /\brefused\b/i, slug: "refused" },
  { pattern: /\bseized\b/i, slug: "seized" },
  { pattern: /\bforwarded\b/i, slug: "forwarded" },
]

function trackingTextBlob(detail: OrderTrackingDetail): string {
  const parts = [
    detail.status_description,
    detail.carrier_status_description,
    detail.exception_description,
    latestCarrierEventDescription(detail),
  ]
  return parts.filter((part) => Boolean(part?.trim())).join(" ")
}

function smsMilestoneForKind(kind: ShippingNotificationKind): OrderShippingSmsMilestone {
  if (kind === "out_for_delivery" || kind === "delivered") return kind
  return "exception"
}

function notificationDay(detail: OrderTrackingDetail): string {
  const raw = detail.events?.[0]?.occurred_at?.trim() || detail.actual_delivery_date?.trim() || ""
  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) return "undated"
  return new Date(parsed).toISOString().slice(0, 10)
}

function exceptionReasonSlug(detail: OrderTrackingDetail): string {
  const text = trackingTextBlob(detail)
  for (const reason of EXCEPTION_REASONS) {
    if (reason.pattern.test(text)) return reason.slug
  }
  return "exception"
}

function dedupeKeyFor(detail: OrderTrackingDetail, kind: ShippingNotificationKind): string {
  if (kind === "delivered") return "delivered"
  if (kind === "exception") return `exception-${exceptionReasonSlug(detail)}`
  return `${kind}-${notificationDay(detail)}`
}

/** Highest-priority milestone on a snapshot. Null means a routine hop — do not notify. */
export function resolveShippingNotificationKind(
  detail: OrderTrackingDetail | null | undefined,
): ShippingNotificationKind | null {
  if (!detail) return null

  if (carrierTrackingIndicatesDelivered(detail)) return "delivered"

  const code = (detail.status_code ?? "").trim().toUpperCase()
  const text = trackingTextBlob(detail)

  if (AVAILABLE_FOR_PICKUP_RE.test(text)) return "available_for_pickup"
  if (code === "AT" || DELIVERY_ATTEMPT_RE.test(text)) return "delivery_attempt"
  if (
    code === "EX" ||
    Boolean(detail.exception_description?.trim()) ||
    EXCEPTION_REASONS.some((reason) => reason.pattern.test(text))
  ) {
    return "exception"
  }
  if (code === "OF" || OUT_FOR_DELIVERY_RE.test(text)) return "out_for_delivery"

  return null
}

/**
 * Notification to emit for this snapshot, or null when it repeats the previous
 * milestone (same day / same exception reason) or is a routine scan.
 */
export function resolveShippingUpdateNotification(
  previous: OrderTrackingDetail | null | undefined,
  next: OrderTrackingDetail,
): ShippingUpdateNotification | null {
  const kind = resolveShippingNotificationKind(next)
  if (!kind) return null

  const dedupeKey = dedupeKeyFor(next, kind)
  if (previous) {
    const previousKind = resolveShippingNotificationKind(previous)
    if (previousKind && dedupeKeyFor(previous, previousKind) === dedupeKey) return null
  }

  return {
    kind,
    smsMilestone: smsMilestoneForKind(kind),
    dedupeKey,
  }
}

/**
 * What the buyer email/SMS path should send.
 * Skips the first persisted snapshot (Order Shipped already covers that) and
 * any scan that is not a new milestone.
 */
export function buyerShippingUpdateToEmit(
  previous: OrderTrackingDetail | null | undefined,
  next: OrderTrackingDetail,
): ShippingUpdateNotification | null {
  if (!orderTrackingUpdateChanged(previous, next)) return null
  return resolveShippingUpdateNotification(previous, next)
}

/** SMS milestone for a snapshot, including attempts and pickup holds as `exception`. */
export function resolveShippingSmsMilestone(
  detail: OrderTrackingDetail | null | undefined,
): OrderShippingSmsMilestone | null {
  const kind = resolveShippingNotificationKind(detail)
  if (!kind) return null
  return smsMilestoneForKind(kind)
}

/** SMS milestone only when this snapshot is a new notification. */
export function resolveShippingSmsMilestoneTransition(
  previous: OrderTrackingDetail | null | undefined,
  next: OrderTrackingDetail,
): OrderShippingSmsMilestone | null {
  return resolveShippingUpdateNotification(previous, next)?.smsMilestone ?? null
}
