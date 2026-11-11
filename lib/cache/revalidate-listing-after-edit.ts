import { revalidatePath, revalidateTag } from "next/cache"
import { BOARDS_BROWSE_CACHE_TAG } from "@/lib/cache/boards-browse-catalog"
import {
  HOME_MOST_VIEWED_CACHE_TAG,
  HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG,
  HOME_RECENTLY_LISTED_GRID_CACHE_TAG,
} from "@/lib/cache/home-public-catalog"
import { NAV_SUGGESTED_SURFBOARDS_CACHE_TAG } from "@/lib/cache/nav-suggested-surfboards"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"

const EXPIRE_NOW = { expire: 0 } as const

/** Expire the concrete `/l/...` shell so the seller lands on the new photos. */
export function expireListingDetailAfterEdit(
  listingId: string,
  slug?: string | null,
): void {
  revalidateListingDetailPage(listingId, slug)
}

/**
 * Drop browse/home tile caches. Safe to run after the save response — the
 * seller navigates to the listing, not `/boards`.
 */
export function expireListingDiscoverySurfacesAfterEdit(): void {
  revalidateTag(BOARDS_BROWSE_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_RECENTLY_LISTED_GRID_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_MOST_VIEWED_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(NAV_SUGGESTED_SURFBOARDS_CACHE_TAG, EXPIRE_NOW)
  revalidatePath("/boards", "page")
  revalidatePath("/", "page")
}

/**
 * Drop cached listing pages and tile grids immediately after a seller save.
 * `'max'` only marks those entries stale-while-revalidate, so `/boards` and
 * the listing can keep painting the previous cover.
 */
export function expirePublicListingSurfacesAfterEdit(
  listingId: string,
  slug?: string | null,
): void {
  expireListingDetailAfterEdit(listingId, slug)
  expireListingDiscoverySurfacesAfterEdit()
}
