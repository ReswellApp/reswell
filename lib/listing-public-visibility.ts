/** Fields needed to decide whether a listing is visible or purchasable on the public site. */
export type ListingPublicVisibilityFields = {
  status: string
  hidden_from_site?: boolean | null
  archived_at?: string | null
}

const PURCHASABLE_STATUSES = new Set(["active", "pending_sale"])
const SAVED_LIST_STATUSES = new Set(["active", "pending_sale", "sold"])

/** Listing appears in browse, search, and public `/l/` pages (excluding sold-only PDP rules). */
export function isListingPubliclyVisible(listing: ListingPublicVisibilityFields): boolean {
  if (listing.archived_at) return false
  if (listing.hidden_from_site) return false
  return PURCHASABLE_STATUSES.has(listing.status)
}

/** Buyer can add to cart or complete checkout. */
export function isListingPurchasable(listing: ListingPublicVisibilityFields): boolean {
  return isListingPubliclyVisible(listing)
}

/** Saved favorites: keep sold boards with overlay; drop archived, removed, hidden, and drafts. */
export function isListingVisibleInSavedList(listing: ListingPublicVisibilityFields): boolean {
  if (listing.archived_at) return false
  if (listing.hidden_from_site) return false
  if (listing.status === "removed" || listing.status === "draft") return false
  return SAVED_LIST_STATUSES.has(listing.status)
}
