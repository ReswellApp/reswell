import {
  ListingDetailPublicBody,
  type PublicListingRow,
} from "@/components/features/listings/listing-detail-public-body"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

/**
 * Visible catalog PDP. Always the anonymous shell so `/l/[listing]` can be
 * cached for every visitor. Owner protection copy and listing controls render
 * in the browser only after the session matches the seller.
 *
 * Awaits the section page before returning so the route `loading.tsx` boundary
 * does not clear until the gallery and the rest of the above-the-fold HTML are
 * ready to commit together.
 */
export async function ListingDetailPublicOrAuthenticated({
  listingParam,
  listing,
}: {
  listingParam: string
  listing: PublicListingRow
  redirectSlug: string | null
}) {
  const sectionProps: ListingDetailPageSharedProps = {
    listingParam,
    prefetchedListing: listing.section === "new" ? undefined : listing,
    anonymousPublicView: true,
  }

  return ListingDetailPublicBody({
    listing,
    listingParam,
    sectionProps,
  })
}
