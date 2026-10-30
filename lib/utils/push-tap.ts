export type PushTapData = {
  conversation_id?: string | null
  support_case_id?: string | null
  listing_id?: string | null
  href?: string | null
}

export type PushTapRoute =
  | { kind: "messages"; id: string }
  | { kind: "support"; id: string }
  | { kind: "listing"; id: string }
  | { kind: "track"; id: string }
  | { kind: "sales"; id: string | null }
  | { kind: "purchases"; id: string | null }
  | { kind: "listings" }
  | { kind: "earnings" }
  | { kind: "following" }
  | { kind: "inbox" }

function firstPath(href: string | null | undefined): string {
  if (!href) return ""
  const path = href.trim().split(/[?#]/)[0] ?? ""
  if (!path.startsWith("/") || path.startsWith("//")) return ""
  return path
}

/** Same destinations the iOS client opens when a lock-screen alert is tapped. */
export function pushTapRoute(data: PushTapData): PushTapRoute {
  const conversationId = data.conversation_id?.trim()
  if (conversationId) return { kind: "messages", id: conversationId }

  const supportCaseId = data.support_case_id?.trim()
  if (supportCaseId) return { kind: "support", id: supportCaseId }

  const path = firstPath(data.href)
  const listing = path.match(/^\/l\/([^/]+)$/)
  if (listing?.[1]) return { kind: "listing", id: listing[1] }

  const track = path.match(/^\/track\/([^/]+)$/)
  if (track?.[1]) return { kind: "track", id: track[1] }

  const sale = path.match(/^\/dashboard\/sales(?:\/([^/]+))?$/)
  if (sale) return { kind: "sales", id: sale[1] ?? null }

  const purchase = path.match(/^\/dashboard\/purchases(?:\/([^/]+))?$/)
  if (purchase) return { kind: "purchases", id: purchase[1] ?? null }

  const thread = path.match(/^\/messages\/([^/]+)$/)
  if (thread?.[1]) return { kind: "messages", id: thread[1] }

  if (path === "/dashboard/listings") return { kind: "listings" }
  if (path === "/dashboard/earnings") return { kind: "earnings" }
  if (path === "/following") return { kind: "following" }
  if (path === "/inbox" || path === "/messages") return { kind: "inbox" }

  const listingId = data.listing_id?.trim()
  if (listingId) return { kind: "listing", id: listingId }
  return { kind: "inbox" }
}
