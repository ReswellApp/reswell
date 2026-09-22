import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { buildInventoryCountBySeller } from "@/lib/sellers/directory-ranking"

export type SellersDirectoryEligibleIdsResult = {
  sellerIds: string[]
  inventoryCountBySeller: Map<string, number>
}

/**
 * Profile ids shown on `/sellers` and used for directory search eligibility:
 * at least one active, visible peer marketplace listing.
 *
 * Shop accounts and sellers with only sold boards stay off the directory until
 * they have something for sale. Reswell retail (`section = new`) is excluded.
 */
export async function fetchSellersDirectoryEligibleSellerIds(
  supabase: SupabaseClient,
): Promise<SellersDirectoryEligibleIdsResult> {
  const { data: activeListingRows, error: activeListingIdsError } = await supabase
    .from("listings")
    .select("user_id")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("section", PEER_LISTING_SECTIONS_FILTER)

  if (activeListingIdsError) {
    console.error("[sellers-directory-eligibility] active listing seller ids:", activeListingIdsError)
  }

  const sellerIdSet = new Set<string>()
  for (const row of activeListingRows ?? []) sellerIdSet.add(row.user_id as string)

  return {
    sellerIds: [...sellerIdSet],
    inventoryCountBySeller: buildInventoryCountBySeller(activeListingRows),
  }
}
