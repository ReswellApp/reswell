import { revalidateTag } from "next/cache"
import { LISTING_PUBLIC_DETAIL_CACHE_TAG } from "@/lib/cache/listing-public-detail"

/** Bust hourly anonymous listing detail cache after publish, sold, or hide events. */
export function revalidateListingPublicDetailCatalog(): void {
  revalidateTag(LISTING_PUBLIC_DETAIL_CACHE_TAG, 'max')
}
