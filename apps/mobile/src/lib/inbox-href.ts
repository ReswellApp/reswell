import type { Href } from "expo-router"

export type InboxNavigationItem = {
  conversation_id?: string | null
  support_case_id?: string | null
  listing_id?: string | null
  href?: string | null
}

/** Map website inbox hrefs onto native account screens. Unknown paths return null. */
export function inboxHrefToNative(href: string | null | undefined): Href | null {
  if (!href) return null
  const path = href.trim().split(/[?#]/)[0] ?? ""
  if (!path.startsWith("/") || path.startsWith("//")) return null

  const listing = path.match(/^\/l\/([^/]+)$/)
  if (listing?.[1]) {
    return { pathname: "/listing/[id]", params: { id: listing[1] } }
  }

  const sale = path.match(/^\/dashboard\/sales(?:\/([^/]+))?$/)
  if (sale) {
    const id = sale[1]
    return id ? { pathname: "/account/sales/[id]", params: { id } } : "/account/sales"
  }

  const purchase = path.match(/^\/dashboard\/purchases(?:\/([^/]+))?$/)
  if (purchase) {
    const id = purchase[1]
    return id ? { pathname: "/account/purchases/[id]", params: { id } } : "/account/purchases"
  }

  if (path === "/dashboard/listings") return "/account/listings"
  if (path === "/dashboard/earnings") return "/account/earnings"
  if (path === "/following") return "/account/following"
  if (path === "/inbox" || path === "/messages") return "/inbox"

  return null
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
  const fromHref = inboxHrefToNative(item.href)
  if (fromHref) return fromHref
  const listingId = item.listing_id?.trim()
  if (listingId) {
    return { pathname: "/listing/[id]", params: { id: listingId } }
  }
  return "/inbox"
}
