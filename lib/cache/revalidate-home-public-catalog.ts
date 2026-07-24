import { revalidatePath, revalidateTag } from "next/cache"
import {
  HOME_MOST_VIEWED_CACHE_TAG,
  HOME_RECENTLY_ADDED_FINS_CACHE_TAG,
  HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG,
  HOME_RECENTLY_SOLD_CACHE_TAG,
  HOME_STABLE_CATALOG_CACHE_TAG,
} from "@/lib/cache/home-public-catalog"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"

/** Bust admin-curated homepage sections after CMS or homepage-visibility changes. */
export function revalidateHomeStableCatalog(): void {
  revalidateTag(HOME_STABLE_CATALOG_CACHE_TAG, 'max')
  revalidatePath("/", "layout")
  revalidatePath("/", "page")
}

/** Bust the auto-generated recently sold strip (e.g. after homepage hide on a sold listing). */
export function revalidateHomeRecentlySoldCatalog(): void {
  revalidateTag(HOME_RECENTLY_SOLD_CACHE_TAG, 'max')
  revalidatePath("/", "page")
}

/** Bust the newest-first recently added surfboards strip. */
export function revalidateHomeRecentlyAddedSurfboardsCatalog(): void {
  revalidateTag(HOME_RECENTLY_ADDED_SURFBOARDS_CACHE_TAG, 'max')
  revalidatePath("/", "page")
}

/** Bust the newest-first recently added fins strip. */
export function revalidateHomeRecentlyAddedFinsCatalog(): void {
  revalidateTag(HOME_RECENTLY_ADDED_FINS_CACHE_TAG, 'max')
  revalidatePath("/", "page")
}

/** Bust the most-viewed strip (e.g. after homepage hide on a high-traffic listing). */
export function revalidateHomeMostViewedCatalog(): void {
  revalidateTag(HOME_MOST_VIEWED_CACHE_TAG, 'max')
  revalidatePath("/", "page")
}

/** Recently sold feeds after a listing leaves the sold state (e.g. refund relist). */
export function revalidateRecentlySoldSurfaces(): void {
  revalidateHomeRecentlySoldCatalog()
  revalidateMarketplaceSoldFeedCatalog()
  revalidatePath("/sold", "page")
  revalidatePath("/sold", "layout")
  revalidatePath("/listyoursurfboard", "page")
}

/** Admin CMS mutations — stable sections only; recently sold keeps its hourly TTL. */
export function revalidateHomePublicCatalog(): void {
  revalidateHomeStableCatalog()
}
