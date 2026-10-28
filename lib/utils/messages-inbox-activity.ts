import { listingDetailHref } from "@/lib/listing-href"
import type { MessagesInboxNotification } from "@/lib/db/messagesInbox"
import {
  isLikelyOrderUuid,
  purchaseHrefForOrderId,
  saleHrefForOrderId,
} from "@/lib/earnings-sale-ledger"
import {
  ORDER_DELIVERED_BUYER_HREF,
  ORDER_DELIVERED_SELLER_HREF,
} from "@/lib/services/notifications/catalog"
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
  if (t === "order_delivered" || t === "order_delivered_payout") return "Order"
  if (t === "payout_info_required") return "Payout"
  if (t === "seller_message_waiting") return "Reply"
  if (t === "seller_listing_hide_warning" || t === "seller_listing_auto_hidden") return "Vacation"
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
  const type = (n.type || "").toLowerCase()
  if (type === "order_delivered_payout") return orderDeliveredHref(n, "seller")
  if (type === "order_delivered") return orderDeliveredHref(n, "buyer")
  const href = n.href?.trim()
  if (href && href.startsWith("/") && !href.startsWith("//")) return href
  if (type === "payout_info_required") return "/dashboard/earnings"
  const listing = n.listings
  if (n.listing_id && listing?.section) {
    return listingDetailHref(listing)
  }
  return "/favorites"
}

function orderDeliveredHref(n: MessagesInboxNotification, role: "seller" | "buyer"): string {
  const orderId = orderIdFromInboxNotification(n)
  if (role === "seller") {
    return orderId ? saleHrefForOrderId(orderId) : ORDER_DELIVERED_SELLER_HREF
  }
  return orderId ? purchaseHrefForOrderId(orderId) : ORDER_DELIVERED_BUYER_HREF
}

function orderIdFromInboxNotification(n: MessagesInboxNotification): string | null {
  const meta = n.metadata
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const raw = meta.orderId
    if (typeof raw === "string" && isLikelyOrderUuid(raw)) return raw.trim()
  }
  const href = n.href?.trim() ?? ""
  if (!href.startsWith("/") || href.startsWith("//")) return null
  const path = href.split(/[?#]/)[0] ?? href
  const match = path.match(/^\/dashboard\/(?:sales|purchases)\/([^/]+)$/)
  const id = match?.[1]?.trim() ?? ""
  return isLikelyOrderUuid(id) ? id : null
}

export function countUnreadInboxActivityNotifications(
  notifications: MessagesInboxNotification[],
): number {
  return filterInboxActivityNotifications(notifications).filter((n) => !n.is_read).length
}
