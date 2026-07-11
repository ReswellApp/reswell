import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateMarketplaceSalesMapCatalog } from "@/lib/cache/revalidate-marketplace-sales-map"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"

function isNextCacheContextMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("static generation store missing") || message.includes("revalidateTag")
}

/**
 * Order settlement must finish Klaviyo + wallet side effects even when invoked outside
 * a Next.js request (recovery scripts, one-off tooling).
 */
export async function safeRevalidateAfterMarketplaceOrderCommit(
  supabase: SupabaseClient,
  params: {
    sellerUserId: string
    listingIds: readonly string[]
    listingSlugs: readonly (string | null | undefined)[]
  },
): Promise<void> {
  try {
    revalidateBoardsBrowseCatalog()
    await revalidateSellersAfterListingChange(supabase, params.sellerUserId)
    revalidateMarketplaceSoldFeedCatalog()
    revalidateMarketplaceSalesMapCatalog()
    for (let i = 0; i < params.listingIds.length; i++) {
      revalidateListingDetailPage(params.listingIds[i]!, params.listingSlugs[i] ?? null)
    }
  } catch (error) {
    if (!isNextCacheContextMissing(error)) {
      console.error("[safeRevalidateAfterMarketplaceOrderCommit]", error)
    }
  }
}
