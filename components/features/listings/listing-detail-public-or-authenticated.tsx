import {
  ListingDetailPublicBody,
  type PublicListingRow,
} from "@/components/features/listings/listing-detail-public-body"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

/**
 * Visible catalog PDP. Always the anonymous shell so `/l/[listing]` can be
 * cached. Favorites, owner tools, and the admin bar hydrate after paint.
 */
export function ListingDetailPublicOrAuthenticated({
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

  return (
    <ListingDetailPublicBody
      listing={listing}
      listingParam={listingParam}
      sectionProps={sectionProps}
    />
  )
}
