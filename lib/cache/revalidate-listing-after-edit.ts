import { revalidatePath, revalidateTag } from "next/cache"
import { BOARDS_BROWSE_CACHE_TAG } from "@/lib/cache/boards-browse-catalog"
import {
  HOME_MOST_VIEWED_CACHE_TAG,
  HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG,
  HOME_RECENTLY_LISTED_GRID_CACHE_TAG,
} from "@/lib/cache/home-public-catalog"
import { NAV_SUGGESTED_SURFBOARDS_CACHE_TAG } from "@/lib/cache/nav-suggested-surfboards"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"

const STALE_WHILE_REVALIDATE = "max" as const

/**
 * Drop the saved listing immediately. Home, browse, and nav grids stay
 * stale-while-revalidate so Save can return to the previous screen without
 * rebuilding those catalogs first.
 */
export function expirePublicListingSurfacesAfterEdit(
  listingId: string,
  slug?: string | null,
): void {
  revalidateListingDetailPage(listingId, slug)
  revalidateTag(BOARDS_BROWSE_CACHE_TAG, STALE_WHILE_REVALIDATE)
  revalidateTag(HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG, STALE_WHILE_REVALIDATE)
  revalidateTag(HOME_RECENTLY_LISTED_GRID_CACHE_TAG, STALE_WHILE_REVALIDATE)
  revalidateTag(HOME_MOST_VIEWED_CACHE_TAG, STALE_WHILE_REVALIDATE)
  revalidateTag(NAV_SUGGESTED_SURFBOARDS_CACHE_TAG, STALE_WHILE_REVALIDATE)
  revalidatePath("/boards", "page")
  revalidatePath("/", "page")
}
