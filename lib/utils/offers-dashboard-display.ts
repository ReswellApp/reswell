import type { DashboardListingEmbed, DashboardOfferRow } from "@/lib/types/offers-dashboard"

export type OffersRoleTab = "seller" | "buyer"

export function parseOffersTab(tab: string | undefined): OffersRoleTab {
  if (tab === "buyer" || tab === "made") return "buyer"
  if (tab === "seller" || tab === "received") return "seller"
  return "seller"
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
