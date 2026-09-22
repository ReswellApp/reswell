import { cookies } from "next/headers"
import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"
import {
  ListingDetailPublicBody,
  type PublicListingRow,
} from "@/components/features/listings/listing-detail-public-body"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

/**
 * Visible catalog PDP: render the cached listing immediately.
 * Signed-in extras (favorites, owner tools, admin bar) stream in from the
 * section page — do not re-fetch the full listing row just because a session exists.
 */
export async function ListingDetailPublicOrAuthenticated({
  listingParam,
  listing,
}: {
  listingParam: string
  listing: PublicListingRow
  redirectSlug: string | null
}) {
  const cookieStore = await cookies()
  const hasAuth = hasSupabaseAuthCookies(cookieStore.getAll())

  const sectionProps: ListingDetailPageSharedProps = {
    listingParam,
    prefetchedListing: listing.section === "new" ? undefined : listing,
    anonymousPublicView: !hasAuth,
  }

  return (
    <ListingDetailPublicBody
      listing={listing}
      listingParam={listingParam}
      sectionProps={sectionProps}
    />
  )
}
