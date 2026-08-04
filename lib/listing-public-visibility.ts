import { isAdminSeedListingTitle } from "@/lib/utils/admin-seed-listing"

/** Fields needed to decide whether a listing is visible or purchasable on the public site. */
export type ListingPublicVisibilityFields = {
  status: string
  title?: string | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  /** Confirmed admin-terminal checkout — show on /sold even when hidden_from_site. */
  soldViaAdminTerminal?: boolean
}

const PURCHASABLE_STATUSES = new Set(["active", "pending_sale"])
const SAVED_LIST_STATUSES = new Set(["active", "pending_sale", "sold"])

/**
 * Core discovery eligibility shared by Elasticsearch and Google Merchant.
 * Stricter than public PDP visibility: status must be `active` (not `pending_sale`).
 */
export function isListingDiscoveryEligible(listing: ListingPublicVisibilityFields): boolean {
  if (isAdminSeedListingTitle(listing.title)) return false
  if (listing.archived_at) return false
  if (listing.hidden_from_site) return false
  return listing.status === "active"
}

/**
 * Whether a listing may be indexed in Elasticsearch.
 * Same gate as discovery eligibility today; section allow-lists stay in the ES layer.
 */
export function isListingExternallyIndexable(listing: ListingPublicVisibilityFields): boolean {
  return isListingDiscoveryEligible(listing)
}

/** Listing appears in browse, search, and public `/l/` pages (excluding sold-only PDP rules). */
export function isListingPubliclyVisible(listing: ListingPublicVisibilityFields): boolean {
  if (isAdminSeedListingTitle(listing.title)) return false
  if (listing.archived_at) return false
  if (listing.hidden_from_site) return false
  return PURCHASABLE_STATUSES.has(listing.status)
}

/** Buyer can add to cart or complete checkout. */
export function isListingPurchasable(listing: ListingPublicVisibilityFields): boolean {
  return isListingPubliclyVisible(listing)
}

/**
 * Public sold feed / recently sold strips.
 * Seller-archived sold listings stay visible; admin hide-from-site (no archive) does not.
 */
export function isListingVisibleInPublicSoldFeed(listing: ListingPublicVisibilityFields): boolean {
  if (isAdminSeedListingTitle(listing.title)) return false
  if (listing.status !== "sold") return false
  if (listing.hidden_from_site && !listing.archived_at && !listing.soldViaAdminTerminal) return false
  return true
}

/** Saved favorites: keep sold boards with overlay; drop archived, removed, hidden, and drafts. */
export function isListingVisibleInSavedList(listing: ListingPublicVisibilityFields): boolean {
  if (listing.archived_at) return false
  if (listing.hidden_from_site) return false
  if (
    listing.status === "removed" ||
    listing.status === "draft" ||
    listing.status === "delinquent"
  ) {
    return false
  }
  return SAVED_LIST_STATUSES.has(listing.status)
}
