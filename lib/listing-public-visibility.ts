/** Fields needed to decide whether a listing is visible or purchasable on the public site. */
export type ListingPublicVisibilityFields = {
  status: string
  title?: string | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  sync_managed?: boolean | null
  stock_quantity?: number | null
}

const PURCHASABLE_STATUSES = new Set(["active", "pending_sale"])
const SAVED_LIST_STATUSES = new Set(["active", "pending_sale", "sold"])

/** Listing appears in browse, search, and public `/l/` pages (excluding sold-only PDP rules). */
export function isListingPubliclyVisible(listing: ListingPublicVisibilityFields): boolean {
  if (isAdminSeedListingTitle(listing.title)) return false
  if (listing.archived_at) return false
  if (listing.hidden_from_site) return false
  return PURCHASABLE_STATUSES.has(listing.status)
}

/** Buyer can add to cart or complete checkout. */
export function isListingPurchasable(listing: ListingPublicVisibilityFields): boolean {
  if (!isListingPubliclyVisible(listing)) return false
  if (listing.sync_managed === true && (Number(listing.stock_quantity) || 0) <= 0) {
    return false
  }
  return true
}

import { isAdminSeedListingTitle } from "@/lib/utils/admin-seed-listing"

/**
 * Public sold feed / recently sold strips.
 * Seller-archived sold listings stay visible; admin hide-from-site (no archive) does not.
 */
export function isListingVisibleInPublicSoldFeed(listing: ListingPublicVisibilityFields): boolean {
  if (isAdminSeedListingTitle(listing.title)) return false
  if (listing.status !== "sold") return false
  if (listing.hidden_from_site && !listing.archived_at) return false
  return true
}

/**
 * Whether a listing row can back a /sold feed card for a confirmed checkout.
 * Sync-managed inventory listings may still be `active` while individual units sell.
 */
export function isListingVisibleAsSoldFeedEntry(listing: ListingPublicVisibilityFields): boolean {
  if (isAdminSeedListingTitle(listing.title)) return false
  if (listing.hidden_from_site && !listing.archived_at) return false

  if (listing.sync_managed === true) {
    return listing.status === "active" || listing.status === "removed" || listing.status === "sold"
  }

  return listing.status === "sold"
}

/** Saved favorites: keep sold boards with overlay; drop archived, removed, hidden, and drafts. */
export function isListingVisibleInSavedList(listing: ListingPublicVisibilityFields): boolean {
  if (listing.archived_at) return false
  if (listing.hidden_from_site) return false
  if (listing.status === "removed" || listing.status === "draft") return false
  return SAVED_LIST_STATUSES.has(listing.status)
}
