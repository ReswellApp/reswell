import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import {
  revalidateSellersAfterListingChange,
  revalidateSellersDirectoryCatalog,
} from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateHomePublicCatalog } from "@/lib/cache/revalidate-home-public-catalog"

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

  revalidateBoardsBrowseCatalog()
  revalidateHomePublicCatalog()
  revalidatePath("/sold")
  revalidatePath("/search")
  revalidatePath("/shop")
  revalidatePath("/")

  if (sellerUserIds.size === 1) {
    await revalidateSellersAfterListingChange(supabase, [...sellerUserIds][0]!)
  } else if (sellerUserIds.size > 1) {
    revalidateSellersDirectoryCatalog()
  } else {
    revalidateSellersDirectoryCatalog()
  }
}
