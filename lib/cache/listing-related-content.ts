import { cache } from "react"
import { unstable_cache } from "next/cache"
import { listRelatedContentPublicForListing } from "@/lib/services/listingRelatedContent"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import {
  LISTING_RELATED_CONTENT_CACHE_TAG,
  listingRelatedContentCacheTag,
  type ListingRelatedContentCard,
} from "@/lib/listing-related-content"

export { LISTING_RELATED_CONTENT_CACHE_TAG, listingRelatedContentCacheTag }

export const LISTING_RELATED_CONTENT_REVALIDATE_SECONDS = 60 * 60

async function loadListingRelatedContent(listingId: string): Promise<ListingRelatedContentCard[]> {
  const supabase = createAnonSupabaseClient()
  return listRelatedContentPublicForListing(supabase, listingId)
}

export const getCachedListingRelatedContent = cache(async (listingId: string) => {
  const id = listingId.trim()
  if (!id) return []
  return unstable_cache(
    () => loadListingRelatedContent(id),
    ["listing-related-content-v5", id],
    {
      revalidate: LISTING_RELATED_CONTENT_REVALIDATE_SECONDS,
      tags: [LISTING_RELATED_CONTENT_CACHE_TAG, listingRelatedContentCacheTag(id)],
    },
  )()
})
