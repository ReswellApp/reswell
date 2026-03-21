/**
 * Centralised helper to build listing detail URLs from a listing object.
 * Every place that links to a listing detail page should use this so that
 * slug-based URLs are consistent across the whole app.
 */

export function listingDetailHref(listing: {
  id: string
  slug?: string | null
  section: string
}): string {
  const identifier = listing.slug || listing.id
  switch (listing.section) {
    case "surfboards":
      return `/boards/${identifier}`
    case "new":
      return `/shop/${identifier}`
    default:
      return `/used/${identifier}`
  }
}

export function boardDetailHref(board: { id: string; slug?: string | null }): string {
  return `/boards/${board.slug || board.id}`
}

export function usedDetailHref(listing: { id: string; slug?: string | null }): string {
  return `/used/${listing.slug || listing.id}`
}
