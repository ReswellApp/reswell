import type { Href } from "expo-router"
import { webHrefToNativePath } from "@reswell/api-contract"
import { z } from "zod"

export type InboxNavigationItem = {
  conversation_id?: string | null
  support_case_id?: string | null
  listing_id?: string | null
  href?: string | null
  offer_id?: string | null
}

/** Map website inbox hrefs onto native account screens. Unknown paths return null. */
export function inboxHrefToNative(href: string | null | undefined): Href | null {
  const mapped = webHrefToNativePath(href)
  return mapped ? (mapped as Href) : null
}

const NOTIFICATION_ITEM_PREFIX = "notification:"
const uuidSchema = z.string().uuid()

/** UUID for a stored inbox notification. Synthetic support rows are not stored on `notifications`. */
export function inboxItemNotificationId(itemId: string): string | null {
  if (!itemId.startsWith(NOTIFICATION_ITEM_PREFIX)) return null
  const parsed = uuidSchema.safeParse(itemId.slice(NOTIFICATION_ITEM_PREFIX.length))
  return parsed.success ? parsed.data : null
}

export function inboxItemToNative(item: InboxNavigationItem): Href {
  const conversationId = item.conversation_id?.trim()
  if (conversationId) {
    return { pathname: "/account/messages/[id]", params: { id: conversationId } }
  }
  const supportCaseId = item.support_case_id?.trim()
  if (supportCaseId) {
    return { pathname: "/account/support/[id]", params: { id: supportCaseId } }
  }
  const offerId = item.offer_id?.trim()
  if (offerId && uuidSchema.safeParse(offerId).success) {
    return { pathname: "/account/offers/[id]", params: { id: offerId } }
  }
  const fromHref = inboxHrefToNative(item.href)
  if (fromHref) return fromHref
  const listingId = item.listing_id?.trim()
  if (listingId) {
    return { pathname: "/listing/[id]", params: { id: listingId } }
  }
  return "/inbox"
}
