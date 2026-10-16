import type { SiteVisibilityReason } from "@/lib/listing-site-visibility-reason"

/** Statuses that are still live inventory. Archiving these takes them off the market. */
const LIVE_LISTING_STATUSES = new Set(["active", "pending", "pending_sale", "draft"])

export type ListingArchiveReason = "seller_archive" | "admin_status"

export type ListingArchivePatch = {
  archived_at: string
  hidden_from_site: true
  site_visibility_reason: SiteVisibilityReason
  updated_at: string
  stock_quantity: number
  status?: "removed"
}

export function isListingForeignKeyDeleteError(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === "23503"
}

/**
 * Fields written when a listing cannot be erased because an order still points
 * at it. Sold listings stay sold so public sale history remains. Live listings
 * become removed.
 */
export function listingArchivePatch(input: {
  status: string
  archivedAt: string
  reason: ListingArchiveReason
}): ListingArchivePatch {
  const patch: ListingArchivePatch = {
    archived_at: input.archivedAt,
    hidden_from_site: true,
    site_visibility_reason: input.reason,
    updated_at: input.archivedAt,
    stock_quantity: 0,
  }
  if (LIVE_LISTING_STATUSES.has(input.status)) {
    patch.status = "removed"
  }
  return patch
}
