import { cookies } from "next/headers"
import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"
import { ListingDetailDynamicGate } from "@/components/features/listings/listing-detail-dynamic-gate"
import {
  ListingDetailPublicBody,
  type PublicListingRow,
} from "@/components/features/listings/listing-detail-public-body"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

/**
 * Public PDP branch: hourly cached shell for guests/crawlers; live session for signed-in
 * viewers (owner tools, favorites, offers) without opting the route shell out of ISR.
 */
export async function ListingDetailPublicOrAuthenticated({
  listingParam,
  listing,
  redirectSlug,
}: {
  listingParam: string
  listing: PublicListingRow
  redirectSlug: string | null
}) {
  const cookieStore = await cookies()
  if (hasSupabaseAuthCookies(cookieStore.getAll())) {
    return (
      <ListingDetailDynamicGate
        listingParam={listingParam}
        prefetchedListing={listing as Record<string, unknown>}
        prefetchedRedirectSlug={redirectSlug}
      />
    )
  }

  const sectionProps: ListingDetailPageSharedProps = {
    listingParam,
    prefetchedListing: listing.section === "new" ? undefined : listing,
    viewerUser: null,
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
