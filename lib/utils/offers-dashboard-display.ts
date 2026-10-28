import { offerIsBinding } from "@/lib/listing-offer-authorization"
import type { DashboardListingEmbed, DashboardOfferRow } from "@/lib/types/offers-dashboard"

export type OffersRoleTab = "seller" | "buyer"

export function parseOffersTab(tab: string | undefined): OffersRoleTab {
  if (tab === "buyer" || tab === "made") return "buyer"
  if (tab === "seller" || tab === "received") return "seller"
  return "seller"
}

const OFFER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Offer id from `?offer=` on the dashboard offers page. Rejects anything that is not a UUID. */
export function parseOfferFocusId(value: string | undefined): string | null {
  const id = value?.trim() ?? ""
  return OFFER_ID_PATTERN.test(id) ? id : null
}

/** Canonical offers URL. Seller links keep `tab=received` so older emails still land here. */
export function dashboardOffersPath(input: {
  role: OffersRoleTab
  offerId?: string | null
}): string {
  const params = new URLSearchParams()
  params.set("tab", input.role === "buyer" ? "buyer" : "received")
  const offerId = input.offerId?.trim()
  if (offerId) params.set("offer", offerId)
  return `/dashboard/offers?${params.toString()}`
}

export function offersPageLoginRedirect(
  basePath: string,
  search: { tab?: string; offer?: string },
): string {
  const params = new URLSearchParams()
  const tab = search.tab?.trim()
  const offerId = parseOfferFocusId(search.offer)
  if (tab) params.set("tab", tab)
  if (offerId) params.set("offer", offerId)
  const dest = params.size > 0 ? `${basePath}?${params.toString()}` : basePath
  return `/auth/login?redirect=${encodeURIComponent(dest)}`
}

function singleListing(
  row: DashboardOfferRow["listings"],
): DashboardListingEmbed | null {
  if (!row) return null
  return Array.isArray(row) ? row[0] ?? null : row
}

export function dashboardListingForOffer(row: DashboardOfferRow): DashboardListingEmbed | null {
  return singleListing(row.listings)
}

export function isSoldListingOffer(offer: DashboardOfferRow): boolean {
  const listing = dashboardListingForOffer(offer)
  return listing?.status === "sold"
}

/** Winning offer on a sold listing — COMPLETED, or legacy ACCEPTED before backfill. */
export function isWinningSoldOffer(offer: DashboardOfferRow): boolean {
  if (offer.status === "COMPLETED") return true
  return isSoldListingOffer(offer) && offer.status === "ACCEPTED"
}

const TERMINAL_STATUSES = new Set(["DECLINED", "EXPIRED", "WITHDRAWN"])

/** Negotiation ended or past `expires_at` (except completed sale records). */
export function isInactiveOffer(offer: DashboardOfferRow, nowMs = Date.now()): boolean {
  if (offer.status === "COMPLETED") return false
  if (TERMINAL_STATUSES.has(offer.status)) return true

  const expMs = new Date(offer.expires_at).getTime()
  if (!Number.isFinite(expMs) || expMs > nowMs) return false

  return offer.status === "PENDING" || offer.status === "COUNTERED" || offer.status === "ACCEPTED"
}

/** Active negotiations only — sold deals and closed negotiations live on /dashboard/offers. */
export function shouldShowOfferInMessagesTab(offer: DashboardOfferRow): boolean {
  if (offer.status === "COMPLETED") return false
  if (isSoldListingOffer(offer)) return false
  if (isInactiveOffer(offer)) return false
  return true
}

/** Active offers plus the completed sale for buyer and seller. */
export function shouldShowOfferInDashboard(offer: DashboardOfferRow): boolean {
  if (isInactiveOffer(offer)) return false
  if (!isSoldListingOffer(offer)) return true
  return isWinningSoldOffer(offer)
}

export function offerIsSoldPresentation(offer: DashboardOfferRow): boolean {
  return isWinningSoldOffer(offer)
}

/**
 * True when this person still has to act: a seller on a pending bid, or a buyer
 * on a counter / seller-initiated offer that has not expired.
 * The listing owner never accepts their own offer to a buyer.
 */
export function offerAwaitsUser(
  offer: DashboardOfferRow,
  role: "buyer" | "seller",
  nowMs = Date.now(),
): boolean {
  if (offerIsSoldPresentation(offer) || isInactiveOffer(offer, nowMs)) return false
  if (offer.seller_initiated) {
    return role === "buyer" && (offer.status === "COUNTERED" || offer.status === "PENDING")
  }
  if (role === "seller") return offer.status === "PENDING"
  return offer.status === "COUNTERED"
}

function plainStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "ACCEPTED":
      return "Accepted"
    case "DECLINED":
      return "Declined"
    case "COUNTERED":
      return "Countered"
    case "EXPIRED":
      return "Expired"
    case "WITHDRAWN":
      return "Withdrawn"
    case "COMPLETED":
      return "Completed"
    default:
      return status
  }
}

/** Pill copy for the person looking at the offer. Actionable rows say Needs you. */
export function offerStatusLabel(
  offer: DashboardOfferRow,
  role: "buyer" | "seller",
  nowMs = Date.now(),
): string {
  if (offerIsSoldPresentation(offer)) return "Sold"
  if (offerAwaitsUser(offer, role, nowMs)) return "Needs you"
  if (role === "seller" && offer.seller_initiated && offer.status === "COUNTERED") return "Offer sent"
  if (role === "seller" && offer.status === "COUNTERED") return "Waiting on buyer"
  if (role === "buyer" && offer.status === "PENDING") return "Waiting on seller"
  if (offer.status === "ACCEPTED" && !offerIsBinding(offer)) {
    return role === "buyer" ? "Ready to pay" : "Waiting on payment"
  }
  return plainStatusLabel(offer.status)
}

/** Whether `userId` is the buyer or seller on this offer row. */
export function userParticipationRole(
  offer: Pick<DashboardOfferRow, "buyer_id" | "seller_id">,
  userId: string,
): "buyer" | "seller" | null {
  if (offer.buyer_id === userId) return "buyer"
  if (offer.seller_id === userId) return "seller"
  return null
}

/**
 * Sent = negotiations the current user started (buyer offer or seller offer to buyer).
 * Not the same as `buyer_id` on the row — seller-initiated offers use the buyer as `buyer_id`.
 */
export function isOfferSentByUser(
  offer: Pick<DashboardOfferRow, "buyer_id" | "seller_id" | "seller_initiated">,
  userId: string,
): boolean {
  const role = userParticipationRole(offer, userId)
  if (!role) return false
  if (role === "buyer") return !offer.seller_initiated
  return !!offer.seller_initiated
}

export function partitionOffersByDirection<T extends DashboardOfferRow>(
  offers: T[],
  userId: string,
): { sent: T[]; received: T[] } {
  const sent: T[] = []
  const received: T[] = []
  for (const offer of offers) {
    if (isOfferSentByUser(offer, userId)) sent.push(offer)
    else received.push(offer)
  }
  const byUpdated = (a: T, b: T) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  sent.sort(byUpdated)
  received.sort(byUpdated)
  return { sent, received }
}

/** Split offers by whether the current user is the buyer or seller on the row. */
export function partitionOffersByRole<T extends DashboardOfferRow>(
  offers: T[],
  userId: string,
): { seller: T[]; buyer: T[] } {
  const seller: T[] = []
  const buyer: T[] = []
  for (const offer of offers) {
    const role = userParticipationRole(offer, userId)
    if (role === "seller") seller.push(offer)
    else if (role === "buyer") buyer.push(offer)
  }
  const byUpdated = (a: T, b: T) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  seller.sort(byUpdated)
  buyer.sort(byUpdated)
  return { seller, buyer }
}
