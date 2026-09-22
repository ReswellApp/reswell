import { ListingDetailAdminBar } from "@/components/features/listings/listing-detail-admin-bar"
import { getSiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"
import {
  listingAdminBarShouldMount,
  listingAdminBarSnapshotFromRow,
} from "@/lib/listing-detail-admin-bar"
import { listListingCartHoldersForAdmin } from "@/lib/services/listingCartHolders"

/**
 * Signed-in admin bar. Do not render this on the public listing page — it
 * reads cookies and opts the document out of the Full Route Cache.
 * Cached pages use `ListingPrivateChromeIsland` instead.
 */
export async function ListingDetailAdminBarGate({
  listing,
  anonymousPublicView,
}: {
  listing: Record<string, unknown>
  anonymousPublicView: boolean
}) {
  if (anonymousPublicView) return null

  const chrome = await getSiteChromeAuthPayload()
  const isAdmin = chrome.bootstrap?.profile?.is_admin === true
  if (!listingAdminBarShouldMount({ anonymousPublicView, isAdmin })) return null

  const snapshot = listingAdminBarSnapshotFromRow(listing)
  if (!snapshot) return null

  const cartHolders = await listListingCartHoldersForAdmin(snapshot.id)
  return <ListingDetailAdminBar listing={snapshot} cartHolders={cartHolders} />
}
