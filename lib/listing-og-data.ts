import { createClient } from "@/lib/supabase/server"
import {
  getCachedPublicListingForMetadata,
  LISTING_META_SELECT,
} from "@/lib/listing-detail-cache"
import { capitalizeWords } from "@/lib/listing-labels"
import {
  buildListingShareSubtitle,
  type ListingMetaInput,
  primaryListingImageUrl,
} from "@/lib/listing-metadata"
import { findListingByParam } from "@/lib/listing-query"
import { canViewHiddenListing } from "@/lib/listing-site-access"

export type ListingOgImagePayload =
  | { ok: false }
  | {
      ok: true
      title: string
      line2?: string
      photoUrl?: string
      sold: boolean
    }

/**
 * Resolves listing fields for dynamic OG image routes (`opengraph-image.tsx`).
 * Mirrors `app/l/[listing]/page.tsx` visibility rules for public crawlers.
 */
export async function getListingOgImagePayload(listingParam: string): Promise<ListingOgImagePayload> {
  let { listing } = await getCachedPublicListingForMetadata(listingParam)
  if (!listing) {
    const supabase = await createClient()
    const live = await findListingByParam(supabase, listingParam, {
      select: LISTING_META_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = live.listing
  }
  if (!listing) {
    return { ok: false }
  }

  if (listing.hidden_from_site) {
    const supabase = await createClient()
    if (!(await canViewHiddenListing(supabase, listing))) {
      return { ok: false }
    }
  }

  const meta = listing as ListingMetaInput
  const sold = listing.status === "sold"
  const rawTitle = listing.title?.trim() || "Listing"
  const displayTitle = capitalizeWords(rawTitle)
  const titleSuffix = sold ? " · Sold" : ""
  const title = `${displayTitle}${titleSuffix}`

  let line2: string | undefined
  if (listing.section === "new") {
    const price = Number(listing.price)
    const pricePrefix = Number.isFinite(price) ? `$${price.toFixed(2)}` : undefined
    line2 = buildListingShareSubtitle(meta, pricePrefix ? { pricePrefix } : undefined)
  } else {
    line2 = buildListingShareSubtitle(meta)
  }

  const photoUrl = primaryListingImageUrl(listing.listing_images)

  return {
    ok: true,
    title,
    line2,
    photoUrl,
    sold,
  }
}
