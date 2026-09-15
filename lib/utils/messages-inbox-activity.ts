import { listingDetailHref } from "@/lib/listing-href"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"
import {
  isSupportActivityType,
  mergeInboxActivityNotifications,
  supportCaseToInboxNotification,
} from "@/lib/utils/support-inbox-activity"

export {
  SUPPORT_REPLY_ACTIVITY_TYPE,
  isSupportActivityType,
  mergeInboxActivityNotifications,
  supportCaseToInboxNotification,
} from "@/lib/utils/support-inbox-activity"

export function activityKindLabel(type: string | undefined): string {
  if (isSupportActivityType(type)) return "Support"
  const t = (type || "").toLowerCase()
  if (t.includes("favorite") || t.includes("save") || t === "listing_saved") return "Favorite"
  if (t.includes("follow")) return "Follow"
  if (t.startsWith("offer_")) return "Offer"
  return "Activity"
}

export function isOfferActivityType(type: string | undefined): boolean {
  return (type || "").toLowerCase().startsWith("offer_")
}

export function isFavoriteActivityType(type: string | undefined): boolean {
  const t = (type || "").toLowerCase()
  if (t.includes("follow")) return false
  return t === "listing_saved" || t.includes("favorite") || t.includes("save")
}

/** Non-offer seller activity shown in the Activity tab and nav dropdown. */
export function filterInboxActivityNotifications(
  notifications: MessagesInboxNotification[],
): MessagesInboxNotification[] {
  return notifications.filter((n) => !isOfferActivityType(n.type))
}

export function inboxActivityNotificationHref(n: MessagesInboxNotification): string {
  if (n.support_case_id) return supportCaseResponseHref(n.support_case_id)
  if (isSupportActivityType(n.type) && n.id.startsWith("support:")) {
    return supportCaseResponseHref(n.id.slice("support:".length))
  }
  const listing = n.listings
  if (n.listing_id && listing?.section) {
    return listingDetailHref(listing)
  }
  return "/dashboard/favorites"
}

export function countUnreadInboxActivityNotifications(
  notifications: MessagesInboxNotification[],
): number {
  return filterInboxActivityNotifications(notifications).filter((n) => !n.is_read).length
}
