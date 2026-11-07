/**
 * Centralised helper to build listing detail URLs from a listing object.
 * All marketplace listings use `/l/{slug-or-id}`.
 */

export function listingDetailHref(listing: {
  id: string
  slug?: string | null
  section?: string
  categories?: { slug?: string | null } | Array<{ slug?: string | null }> | null
}): string {
  const identifier = listing.slug?.trim() || listing.id
  return `/l/${identifier}`
}

export function boardDetailHref(board: { id: string; slug?: string | null }): string {
  return `/l/${board.slug || board.id}`
}

/** Peer-to-peer checkout (surfboards). */
export function peerListingCheckoutHref(
  _listingSection: string,
  listingSlugOrId: string,
  options?: { quantity?: number; buyAgain?: boolean },
): string {
  const params = new URLSearchParams()
  params.set("listing", listingSlugOrId)
  const quantity = Math.floor(Number(options?.quantity) || 0)
  if (quantity > 1) params.set("qty", String(quantity))
  if (options?.buyAgain) params.set("buy_again", "1")
  return `/checkout?${params.toString()}`
}

/** Checkout all listings from an accepted offer (single or bundled). */
export function acceptedOfferCheckoutHref(offerId: string): string {
  const params = new URLSearchParams()
  params.set("offer", offerId)
  return `/checkout?${params.toString()}`
}

/** Cart URL that adds this listing after auth (used by PDP Klarna). */
export function cartAddListingHref(listingId: string): string {
  const params = new URLSearchParams()
  params.set("add", listingId)
  return `/cart?${params.toString()}`
}
