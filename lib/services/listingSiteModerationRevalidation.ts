import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import {
  revalidateSellersAfterListingChange,
  revalidateSellersDirectoryCatalog,
} from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import {
  revalidateHomePublicCatalog,
  revalidateHomeRecentlyAddedFinsCatalog,
  revalidateHomeRecentlyAddedSurfboardsCatalog,
} from "@/lib/cache/revalidate-home-public-catalog"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateNavSuggestedSurfboards } from "@/lib/cache/revalidate-nav-suggested-surfboards"

type ListingModerationRow = {
  id: string
  slug: string | null
  user_id: string
}

type ListingDeletionRow = ListingModerationRow & {
  status?: string | null
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

  revalidateBoardsBrowseCatalog()
  revalidateHomePublicCatalog()
  revalidateHomeRecentlyAddedSurfboardsCatalog()
  revalidateHomeRecentlyAddedFinsCatalog()
  revalidateNavSuggestedSurfboards()
  revalidateNavSearchSuggest()
  revalidatePath("/sold")
  revalidatePath("/search")
  revalidatePath("/")

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

  await revalidateListingCatalogSurfaces(supabase, (data ?? []) as ListingModerationRow[])
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
