import { revalidatePath, revalidateTag } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { BOARDS_BROWSE_CACHE_TAG } from "@/lib/cache/boards-browse-catalog"
import {
  HOME_MOST_VIEWED_CACHE_TAG,
  HOME_RECENTLY_ADDED_FINS_CACHE_TAG,
  HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG,
  HOME_RECENTLY_LISTED_GRID_CACHE_TAG,
  HOME_STABLE_CATALOG_CACHE_TAG,
} from "@/lib/cache/home-public-catalog"
import { NAV_SEARCH_SUGGEST_CACHE_TAG } from "@/lib/cache/nav-search-suggest"
import { NAV_SUGGESTED_SURFBOARDS_CACHE_TAG } from "@/lib/cache/nav-suggested-surfboards"
import { PRICE_GUIDE_CACHE_TAG } from "@/lib/cache/price-guide"
import {
  revalidateSellersAfterListingChange,
  revalidateSellersDirectoryCatalog,
} from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { revalidateTopCitiesDirectory } from "@/lib/cache/revalidate-top-cities-directory"

const EXPIRE_NOW = { expire: 0 } as const

type ListingModerationRow = {
  id: string
  slug: string | null
  user_id: string
}

type ListingDeletionRow = ListingModerationRow & {
  status?: string | null
}

/**
 * Hard-expire browse/home/search caches so a hide cannot linger on discovery
 * surfaces. Does not SWR-bust the global listing-PDP catalog tag.
 */
function expireListingDiscoveryCatalogs(): void {
  revalidateTag(BOARDS_BROWSE_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_STABLE_CATALOG_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_RECENTLY_ADDED_FINS_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_MOST_VIEWED_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(HOME_RECENTLY_LISTED_GRID_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(NAV_SUGGESTED_SURFBOARDS_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(NAV_SEARCH_SUGGEST_CACHE_TAG, EXPIRE_NOW)
  revalidateTag(PRICE_GUIDE_CACHE_TAG, EXPIRE_NOW)
  revalidatePath("/priceguide", "layout")
  revalidatePath("/boards", "page")
  revalidatePath("/", "layout")
  revalidatePath("/", "page")
  revalidatePath("/search")
  revalidatePath("/sold")
  revalidateTopCitiesDirectory()
}

async function revalidateListingCatalogSurfaces(
  supabase: SupabaseClient,
  rows: ListingModerationRow[],
  options?: { includeSoldFeed?: boolean },
): Promise<void> {
  if (rows.length === 0) return

  const sellerUserIds = new Set<string>()

  for (const row of rows) {
    revalidateListingDetailPage(row.id, row.slug)
    const sellerUserId = typeof row.user_id === "string" ? row.user_id.trim() : ""
    if (sellerUserId) sellerUserIds.add(sellerUserId)
  }

  expireListingDiscoveryCatalogs()

  if (options?.includeSoldFeed) {
    revalidateMarketplaceSoldFeedCatalog()
  }

  if (sellerUserIds.size === 1) {
    await revalidateSellersAfterListingChange(supabase, [...sellerUserIds][0]!)
  } else {
    revalidateSellersDirectoryCatalog()
  }
}

/** Invalidate browse, search, seller, and PDP caches after hide/remove/restore. */
export async function revalidateAfterListingSiteModeration(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<void> {
  if (listingIds.length === 0) return

  const { data } = await supabase
    .from("listings")
    .select("id, slug, user_id")
    .in("id", listingIds)

  const rows = (data ?? []) as ListingModerationRow[]
  if (rows.length === 0) {
    for (const listingId of listingIds) {
      const trimmed = listingId.trim()
      if (trimmed) revalidateListingDetailPage(trimmed)
    }
    expireListingDiscoveryCatalogs()
    return
  }

  await revalidateListingCatalogSurfaces(supabase, rows)
}

/**
 * Same catalog invalidation as moderation, but accepts rows captured before a hard delete
 * (the listing row no longer exists afterward).
 */
export async function revalidateAfterListingDeletion(
  supabase: SupabaseClient,
  rows: ListingDeletionRow[],
): Promise<void> {
  const includeSoldFeed = rows.some((row) => row.status === "sold")
  await revalidateListingCatalogSurfaces(supabase, rows, { includeSoldFeed })
}
