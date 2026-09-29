import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"

/**
 * After a listing write that can change the public buy price or shop grid.
 * Expires the hourly `/l` Data Cache (not just the route) so cards and the PDP match.
 */
export async function revalidateAfterListingWrite(
  supabase: SupabaseClient,
  params: {
    listingId: string
    slug: string | null
    sellerUserId: string
    section?: string | null
  },
): Promise<void> {
  await revalidateSellersAfterListingChange(supabase, params.sellerUserId)
  revalidateListingDetailPage(params.listingId, params.slug)
  if (params.section === "surfboards") {
    revalidateBoardsBrowseCatalog()
  }
}
