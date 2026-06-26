import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateHomeRecentlySoldCatalog } from "@/lib/cache/revalidate-home-public-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { markUserListingBoardModelDataSold } from "@/lib/db/user-listing-board-model-data"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"

export type ListingSoldSiteEffectsParams = {
  listingId: string
  listingSlug: string | null
  sellerUserId: string
  soldPriceUsd: number
}

export type MarkListingSoldForCheckoutResult =
  | { ok: true; wasAlreadySold: boolean }
  | { ok: false; error: string }

/**
 * Transition a listing to sold and propagate public site effects. Idempotent when already sold.
 */
export async function markListingSoldForCheckout(
  service: SupabaseClient,
  params: ListingSoldSiteEffectsParams,
): Promise<MarkListingSoldForCheckoutResult> {
  const { data: current, error: fetchErr } = await service
    .from("listings")
    .select("id, status")
    .eq("id", params.listingId)
    .maybeSingle()

  if (fetchErr || !current) {
    return { ok: false, error: "Listing not found." }
  }

  const wasAlreadySold = current.status === "sold"
  if (!wasAlreadySold) {
    if (current.status !== "active" && current.status !== "pending_sale") {
      return { ok: false, error: "Listing is not available for sale." }
    }

    const { data: soldRow, error: soldErr } = await service
      .from("listings")
      .update({ status: "sold", updated_at: new Date().toISOString() })
      .eq("id", params.listingId)
      .in("status", ["active", "pending_sale"])
      .select("id")
      .maybeSingle()

    if (soldErr) {
      console.error("[markListingSoldForCheckout] update failed", soldErr)
      return { ok: false, error: "Could not mark the listing sold." }
    }
    if (!soldRow) {
      return { ok: false, error: "Listing is no longer available for sale." }
    }
  }

  await applyListingSoldSiteEffects(service, params)
  return { ok: true, wasAlreadySold }
}

/**
 * Propagate a confirmed sale across browse, PDP, sold feeds, search, Merchant, and carts.
 * Call after `listings.status` is set to `sold`.
 */
export async function applyListingSoldSiteEffects(
  service: SupabaseClient,
  params: ListingSoldSiteEffectsParams,
): Promise<void> {
  try {
    await deleteAllCartRowsForListing(service, params.listingId)
  } catch {
    // best-effort
  }

  void markUserListingBoardModelDataSold(service, params.listingId, params.soldPriceUsd)

  try {
    await syncListingToIndex(service, params.listingId)
  } catch {
    // ES optional
  }

  syncListingToGoogleMerchantBestEffort(service, params.listingId)

  revalidateListingDetailPage(params.listingId, params.listingSlug)
  revalidateBoardsBrowseCatalog()
  revalidateMarketplaceSoldFeedCatalog()
  revalidateHomeRecentlySoldCatalog()
  await revalidateSellersAfterListingChange(service, params.sellerUserId)
}
