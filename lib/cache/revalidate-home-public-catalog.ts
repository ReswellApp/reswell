import { revalidatePath, revalidateTag } from "next/cache"
import {
  HOME_RECENTLY_SOLD_CACHE_TAG,
  HOME_STABLE_CATALOG_CACHE_TAG,
} from "@/lib/cache/home-public-catalog"

/** Bust admin-curated homepage sections after CMS or homepage-visibility changes. */
export function revalidateHomeStableCatalog(): void {
  revalidateTag(HOME_STABLE_CATALOG_CACHE_TAG)
  revalidatePath("/", "layout")
  revalidatePath("/", "page")
}

/** Bust the auto-generated recently sold strip (e.g. after homepage hide on a sold listing). */
export function revalidateHomeRecentlySoldCatalog(): void {
  revalidateTag(HOME_RECENTLY_SOLD_CACHE_TAG)
  revalidatePath("/", "page")
}

/** Recently sold feeds after a listing leaves the sold state (e.g. refund relist). */
export function revalidateRecentlySoldSurfaces(): void {
  revalidateHomeRecentlySoldCatalog()
  revalidatePath("/sold", "page")
  revalidatePath("/sold", "layout")
  revalidatePath("/listyoursurfboard", "page")
}

/** Admin CMS mutations — stable sections only; recently sold keeps its hourly TTL. */
export function revalidateHomePublicCatalog(): void {
  revalidateHomeStableCatalog()
}
