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
export function peerListingCheckoutHref(_listingSection: string, listingSlugOrId: string): string {
  const params = new URLSearchParams()
  params.set("listing", listingSlugOrId)
  return `/checkout?${params.toString()}`
}
