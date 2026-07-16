import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateSellersForUserIds } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateRecentlySoldSurfaces } from "@/lib/cache/revalidate-home-public-catalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { grantExclusiveWindowForRefundedOrderRelist } from "@/lib/services/listingBuyerExclusiveWindow"

function uniqueListingIds(listingIds: readonly (string | null | undefined)[]): string[] {
  return [...new Set(listingIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
}

/**
 * Re-activate listings after a full refund.
 * Only transitions from `sold` → `active`; archived/removed listings are left as-is.
 */
export async function relistListingsAfterRefund(
  supabase: SupabaseClient,
  listingIds: readonly (string | null | undefined)[],
): Promise<void> {
  const uniqueIds = uniqueListingIds(listingIds)
  if (uniqueIds.length === 0) {
    revalidateRecentlySoldSurfaces()
    return
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("listings")
    .update({ status: "active", updated_at: nowIso })
    .in("id", uniqueIds)
    .eq("status", "sold")
    .select("id, user_id")

  if (error) {
    console.error("[relist] failed to reactivate listings after refund", {
      listingIds: uniqueIds,
      error,
    })
    revalidateRecentlySoldSurfaces()
    return
  }

  const relistedIds = (data ?? [])
    .map((row) => (row as { id?: string | null }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  revalidateRecentlySoldSurfaces()

  if (relistedIds.length === 0) {
    return
  }

  revalidateBoardsBrowseCatalog()
  const sellerUserIds = (data ?? [])
    .map((row) => (row as { user_id?: string | null }).user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  await revalidateSellersForUserIds(supabase, sellerUserIds)

  for (const listingId of relistedIds) {
    void syncListingToGoogleMerchantBestEffort(supabase, listingId)
    void syncListingToIndex(supabase, listingId)
  }
}

async function applyExclusiveBuyerWindowAfterRelist(
  supabase: SupabaseClient,
  orderId: string,
  relistedIds: readonly string[],
): Promise<void> {
  if (relistedIds.length === 0) return
  await grantExclusiveWindowForRefundedOrderRelist(supabase, orderId, relistedIds)
}

/** Re-activate a single listing after a full refund. */
export async function relistAfterRefund(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  await relistListingsAfterRefund(supabase, [listingId])
}

/** Re-list every marketplace line on an order (primary `orders.listing_id` + `order_items`). */
export async function relistOrderListingsAfterRefund(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const [{ data: order, error: orderErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabase.from("orders").select("listing_id").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("listing_id").eq("order_id", orderId),
  ])

  if (orderErr) {
    console.error("[relist] order lookup failed", { orderId, error: orderErr })
  }
  if (itemsErr) {
    console.error("[relist] order_items lookup failed", { orderId, error: itemsErr })
  }

  const listingIds = [
    (order as { listing_id?: string | null } | null)?.listing_id,
    ...(items ?? []).map((row) => (row as { listing_id?: string | null }).listing_id),
  ]

  const uniqueIds = uniqueListingIds(listingIds)
  await relistListingsAfterRefund(supabase, uniqueIds)
  await applyExclusiveBuyerWindowAfterRelist(supabase, orderId, uniqueIds)
}
