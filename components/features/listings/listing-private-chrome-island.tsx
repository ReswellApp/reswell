"use client"

import { ListingDetailAdminBar } from "@/components/features/listings/listing-detail-admin-bar"
import { useListingViewer } from "@/components/features/listings/listing-viewer-provider"
import {
  listingAdminBarSnapshotFromRow,
  type ListingAdminBarSnapshot,
} from "@/lib/listing-detail-admin-bar"

/**
 * Admin bar for a cached listing page. Absent from the HTML until the browser
 * session says this viewer is an admin. Seller controls stay in the listing column.
 */
export function ListingPrivateChromeIsland({
  listing,
}: {
  listing: Record<string, unknown>
}) {
  const viewer = useListingViewer()
  const listingId = typeof listing.id === "string" ? listing.id : ""
  const chrome = viewer?.privateChrome ?? null
  const snapshot: ListingAdminBarSnapshot | null = listingAdminBarSnapshotFromRow(listing)

  if (!chrome?.isAdmin || !snapshot || !listingId) return null

  return <ListingDetailAdminBar listing={snapshot} cartHolders={chrome.adminHolders} />
}
