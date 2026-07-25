import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { buildInventoryCountBySeller } from "@/lib/sellers/directory-ranking"

export type SellersDirectoryEligibleIdsResult = {
  sellerIds: string[]
  inventoryCountBySeller: Map<string, number>
}

/**
 * Profile ids shown on `/sellers` and used for directory search eligibility:
 * - shop accounts (`is_shop`), OR
 * - at least one active visible peer marketplace listing, OR
 * - at least one sold surfboard listing (visible, not archived).
 *
 * Reswell retail (`section = new`) is excluded — it lives only on `/reswell/shop`.
 */
export async function fetchSellersDirectoryEligibleSellerIds(
  supabase: SupabaseClient,
): Promise<SellersDirectoryEligibleIdsResult> {
  const [
    { data: shopRows, error: shopIdsError },
    { data: activeListingRows, error: activeListingIdsError },
    { data: soldSurfboardRows, error: soldSurfboardIdsError },
  ] = await Promise.all([
    supabase.from("profiles").select("id").eq("is_shop", true),
    supabase
      .from("listings")
      .select("user_id")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .in("section", PEER_LISTING_SECTIONS_FILTER),
    supabase
      .from("listings")
      .select("user_id")
      .eq("status", "sold")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false)
      .is("archived_at", null),
  ])

  if (shopIdsError) {
    console.error("[sellers-directory-eligibility] profiles (is_shop):", shopIdsError)
  }
  if (activeListingIdsError) {
    console.error("[sellers-directory-eligibility] active listing seller ids:", activeListingIdsError)
  }
  if (soldSurfboardIdsError) {
    console.error("[sellers-directory-eligibility] sold surfboard seller ids:", soldSurfboardIdsError)
  }

  const sellerIdSet = new Set<string>()
  for (const row of shopRows ?? []) sellerIdSet.add(row.id as string)
  for (const row of activeListingRows ?? []) sellerIdSet.add(row.user_id as string)
  for (const row of soldSurfboardRows ?? []) sellerIdSet.add(row.user_id as string)

  return {
    sellerIds: [...sellerIdSet],
    inventoryCountBySeller: buildInventoryCountBySeller(activeListingRows),
  }
}
