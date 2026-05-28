import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateRecentlySoldSurfaces } from "@/lib/cache/revalidate-home-public-catalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"

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
    .select("id")

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

  for (const listingId of relistedIds) {
    void syncListingToGoogleMerchantBestEffort(supabase, listingId)
    void syncListingToIndex(supabase, listingId)
  }
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

  await relistListingsAfterRefund(supabase, listingIds)
}
