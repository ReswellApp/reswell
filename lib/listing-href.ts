/**
 * Centralised helper to build listing detail URLs from a listing object.
 * Every place that links to a listing detail page should use this so that
 * slug-based URLs are consistent across the whole app.
 */

export function listingDetailHref(listing: {
  id: string
  slug?: string | null
  section: string
  categories?: { slug?: string | null } | Array<{ slug?: string | null }> | null
}): string {
  const identifier = listing.slug || listing.id
  switch (listing.section) {
    case "surfboards":
      return `/boards/${identifier}`
    case "new":
      return `/shop/${identifier}`
    case "used": {
      const c = listing.categories
      const row = c && (Array.isArray(c) ? c[0] : c)
      const cat = row?.slug?.trim()
      if (cat) return `/${cat}/${identifier}`
      return `/${identifier}`
    }
    default:
      return `/${identifier}`
  }
}

export function boardDetailHref(board: { id: string; slug?: string | null }): string {
  return `/boards/${board.slug || board.id}`
}

export function usedDetailHref(listing: {
  id: string
  slug?: string | null
  categories?: { slug?: string | null } | Array<{ slug?: string | null }> | null
}): string {
  return listingDetailHref({ ...listing, section: "used" })
}

/**
 * Peer-to-peer checkout URL. Surfboards use `/boards/.../checkout`;
 * used gear uses `/checkout/listing`.
 */
export function peerListingCheckoutHref(listingSection: string, listingSlugOrId: string): string {
  if (listingSection === "surfboards") {
    return `/boards/${listingSlugOrId}/checkout`
  }
  const params = new URLSearchParams()
  params.set("listing", listingSlugOrId)
  return `/checkout/listing?${params.toString()}`
}
