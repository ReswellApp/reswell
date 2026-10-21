/** In-app notification types, caps, and copy. Email stays on the existing Klaviyo callers. */

export const LISTING_SAVED_DAILY_CAP = 10
export const NEW_LISTING_DAILY_CAP = 8
export const NEW_LISTING_PER_SELLER_DAILY_CAP = 2
export const PRICE_DROP_DAILY_CAP = 5
export const PRICE_DROP_MIN_FRACTION = 0.1
export const NOTIFICATION_WINDOW_HOURS = 24

export const NOTIFICATION_TYPES = [
  "listing_saved",
  "listing_saved_digest",
  "offer_received",
  "offer_countered",
  "offer_accepted",
  "offer_declined",
  "offer_withdrawn",
  "offer_expired",
  "offer_expiring_soon",
  "new_listing_from_followed",
  "new_listing_from_followed_digest",
  "price_drop_from_followed",
  "payout_info_required",
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type OfferNotificationType =
  | "offer_received"
  | "offer_countered"
  | "offer_accepted"
  | "offer_declined"
  | "offer_withdrawn"
  | "offer_expired"
  | "offer_expiring_soon"

export const FOLLOW_BELL_NOTIFICATION_TYPES = [
  "new_listing_from_followed",
  "new_listing_from_followed_digest",
  "price_drop_from_followed",
] as const

export type NotificationPublishMode = "once" | "upsert_unread" | "capped_then_digest"

export interface NotificationPolicy {
  type: NotificationType
  mode: NotificationPublishMode
  windowHours: number
  maxPerWindow?: number
  maxPerSubjectWindow?: number
  digestType?: NotificationType
  /** When set, a false preference skips the row. Transactional types omit this. */
  preference?: "follow_in_app"
}

export const NOTIFICATION_POLICIES: Record<NotificationType, NotificationPolicy> = {
  listing_saved: {
    type: "listing_saved",
    mode: "capped_then_digest",
    windowHours: NOTIFICATION_WINDOW_HOURS,
    maxPerWindow: LISTING_SAVED_DAILY_CAP,
    digestType: "listing_saved_digest",
  },
  listing_saved_digest: {
    type: "listing_saved_digest",
    mode: "upsert_unread",
    windowHours: NOTIFICATION_WINDOW_HOURS,
  },
  offer_received: { type: "offer_received", mode: "once", windowHours: NOTIFICATION_WINDOW_HOURS },
  offer_countered: { type: "offer_countered", mode: "once", windowHours: NOTIFICATION_WINDOW_HOURS },
  offer_accepted: { type: "offer_accepted", mode: "once", windowHours: NOTIFICATION_WINDOW_HOURS },
  offer_declined: { type: "offer_declined", mode: "once", windowHours: NOTIFICATION_WINDOW_HOURS },
  offer_withdrawn: { type: "offer_withdrawn", mode: "once", windowHours: NOTIFICATION_WINDOW_HOURS },
  offer_expired: { type: "offer_expired", mode: "once", windowHours: NOTIFICATION_WINDOW_HOURS },
  offer_expiring_soon: {
    type: "offer_expiring_soon",
    mode: "once",
    windowHours: NOTIFICATION_WINDOW_HOURS,
  },
  new_listing_from_followed: {
    type: "new_listing_from_followed",
    mode: "capped_then_digest",
    windowHours: NOTIFICATION_WINDOW_HOURS,
    maxPerWindow: NEW_LISTING_DAILY_CAP,
    maxPerSubjectWindow: NEW_LISTING_PER_SELLER_DAILY_CAP,
    digestType: "new_listing_from_followed_digest",
    preference: "follow_in_app",
  },
  new_listing_from_followed_digest: {
    type: "new_listing_from_followed_digest",
    mode: "upsert_unread",
    windowHours: NOTIFICATION_WINDOW_HOURS,
    preference: "follow_in_app",
  },
  price_drop_from_followed: {
    type: "price_drop_from_followed",
    mode: "upsert_unread",
    windowHours: NOTIFICATION_WINDOW_HOURS,
    maxPerWindow: PRICE_DROP_DAILY_CAP,
    preference: "follow_in_app",
  },
  payout_info_required: {
    type: "payout_info_required",
    mode: "once",
    windowHours: NOTIFICATION_WINDOW_HOURS,
  },
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export function notificationDayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function listingSavedDedupeKey(listingId: string, actorId: string, day: string): string {
  return `listing_saved:${listingId}:${actorId}:${day}`
}

export function listingSavedDigestDedupeKey(day: string): string {
  return `listing_saved_digest:${day}`
}

export function newListingDedupeKey(listingId: string): string {
  return `new_listing_from_followed:${listingId}`
}

export function newListingDigestDedupeKey(sellerId: string, day: string): string {
  return `new_listing_from_followed_digest:${sellerId}:${day}`
}

export function priceDropDedupeKey(listingId: string): string {
  return `price_drop_from_followed:${listingId}`
}

export function offerDedupeKey(
  type: OfferNotificationType,
  offerId: string,
  amountUsd?: number,
): string {
  if (type === "offer_countered") {
    const cents = Number.isFinite(amountUsd) ? Math.round((amountUsd ?? 0) * 100) : 0
    return `offer_countered:${offerId}:${cents}`
  }
  return `${type}:${offerId}`
}

export function payoutInfoDedupeKey(fingerprint: string): string {
  return `payout_info_required:${fingerprint}`
}

export function priceDropMeetsThreshold(oldPrice: number, newPrice: number): boolean {
  if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice <= 0) return false
  if (!(newPrice < oldPrice)) return false
  return (oldPrice - newPrice) / oldPrice >= PRICE_DROP_MIN_FRACTION
}

export function listingSavedBody(title: string): string {
  const name = title.trim() || "your listing"
  return `Someone saved your item: ${name}`
}

export function listingSavedDigestBody(count: number): string {
  const noun = count === 1 ? "person" : "people"
  return `${count} more ${noun} saved your listings today.`
}

export function newListingBody(title: string): string {
  const name = title.trim() || "a listing"
  return `New listing: ${name}`
}

export function newListingDigestBody(shopName: string, count: number): string {
  const name = shopName.trim() || "A seller"
  const noun = count === 1 ? "listing" : "listings"
  return `${name} posted ${count} more ${noun}.`
}

export function priceDropBody(title: string, oldPrice: number, newPrice: number): string {
  const name = title.trim() || "a listing"
  return `Price drop on "${name}" — $${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)}`
}

export function offerNotificationTitle(type: OfferNotificationType): string {
  switch (type) {
    case "offer_received":
      return "New offer"
    case "offer_countered":
      return "Counteroffer"
    case "offer_accepted":
      return "Offer accepted"
    case "offer_declined":
      return "Offer declined"
    case "offer_withdrawn":
      return "Offer withdrawn"
    case "offer_expired":
      return "Offer expired"
    case "offer_expiring_soon":
      return "Offer expiring"
  }
}

export const LISTING_SAVED_DIGEST_HREF = "/dashboard/listings"
export const NEW_LISTING_DIGEST_HREF = "/following"
export const PAYOUT_INFO_HREF = "/dashboard/earnings"
