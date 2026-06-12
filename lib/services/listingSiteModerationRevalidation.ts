import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateHomePublicCatalog } from "@/lib/cache/revalidate-home-public-catalog"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateNavSuggestedSurfboards } from "@/lib/cache/revalidate-nav-suggested-surfboards"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import {
  revalidateSellersAfterListingChange,
  revalidateSellersDirectoryCatalog,
  revalidateSellersForUserIds,
} from "@/lib/cache/revalidate-sellers-directory-catalog"

type ListingRemovalParams = {
  listingId: string
  slug?: string | null
  sellerUserId?: string | null
}

function revalidatePublicListingCatalogSurfaces(): void {
  revalidateBoardsBrowseCatalog()
  revalidateHomePublicCatalog()
  revalidateNavSuggestedSurfboards()
  revalidateNavSearchSuggest()
  revalidatePath("/sold")
  revalidatePath("/search")
  revalidatePath("/shop")
  revalidatePath("/")
}

async function revalidateSellerSurfacesAfterListingRemoval(
  supabase: SupabaseClient,
  sellerUserId?: string | null,
): Promise<void> {
  const trimmedSellerId = typeof sellerUserId === "string" ? sellerUserId.trim() : ""
  if (trimmedSellerId) {
    await revalidateSellersAfterListingChange(supabase, trimmedSellerId)
    return
  }
  revalidateSellersDirectoryCatalog()
}

/** Invalidate browse, home, search, seller, and PDP caches after delete or archive. */
export async function revalidateAfterListingRemoval(
  supabase: SupabaseClient,
  params: ListingRemovalParams,
): Promise<void> {
  const listingId = params.listingId.trim()
  if (!listingId) return

  revalidateListingDetailPage(listingId, params.slug ?? null)
  revalidatePublicListingCatalogSurfaces()
  await revalidateSellerSurfacesAfterListingRemoval(supabase, params.sellerUserId)
}

/** Bulk variant for cron purges that remove many archived listings at once. */
export async function revalidateAfterBulkListingRemoval(
  supabase: SupabaseClient,
  sellerUserIds: readonly string[],
): Promise<void> {
  revalidatePublicListingCatalogSurfaces()

  const uniqueSellerIds = [
    ...new Set(sellerUserIds.map((id) => id.trim()).filter((id) => id.length > 0)),
  ]
  if (uniqueSellerIds.length === 1) {
    await revalidateSellersAfterListingChange(supabase, uniqueSellerIds[0]!)
    return
  }
  if (uniqueSellerIds.length > 1) {
    await revalidateSellersForUserIds(supabase, uniqueSellerIds)
    return
  }
  revalidateSellersDirectoryCatalog()
}

type ListingModerationRow = {
  id: string
  slug: string | null
  user_id: string
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
  const sellerUserIds = new Set<string>()

  for (const row of rows) {
    revalidateListingDetailPage(row.id, row.slug)
    const sellerUserId = typeof row.user_id === "string" ? row.user_id.trim() : ""
    if (sellerUserId) sellerUserIds.add(sellerUserId)
  }

  revalidatePublicListingCatalogSurfaces()

  if (sellerUserIds.size === 1) {
    await revalidateSellersAfterListingChange(supabase, [...sellerUserIds][0]!)
  } else if (sellerUserIds.size > 1) {
    revalidateSellersDirectoryCatalog()
  } else {
    revalidateSellersDirectoryCatalog()
  }
}
