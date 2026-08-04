import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateSellersForUserIds } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateRecentlySoldSurfaces } from "@/lib/cache/revalidate-home-public-catalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { grantExclusiveWindowForRefundedOrderRelist } from "@/lib/services/listingBuyerExclusiveWindow"
import { recordListingVisibilityEvents } from "@/lib/services/listingVisibilityAudit"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"

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
  const { data: soldRows, error: soldErr } = await supabase
    .from("listings")
    .select("id, user_id")
    .in("id", uniqueIds)
    .eq("status", "sold")

  if (soldErr) {
    console.error("[relist] failed to load sold listings for refund relist", {
      listingIds: uniqueIds,
      error: soldErr,
    })
    revalidateRecentlySoldSurfaces()
    return
  }

  const rows = soldRows ?? []
  if (rows.length === 0) {
    revalidateRecentlySoldSurfaces()
    return
  }

  const sellerIds = [
    ...new Set(
      rows
        .map((row) => (row as { user_id?: string | null }).user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]

  const bannedSellerIds = new Set<string>()
  await Promise.all(
    sellerIds.map(async (sellerId) => {
      const banState = await fetchSellerBanState(supabase, sellerId)
      if (isSellerBanActive(banState)) bannedSellerIds.add(sellerId)
    }),
  )

  const liveIds = rows
    .filter((row) => {
      const sellerId = (row as { user_id?: string | null }).user_id
      return typeof sellerId === "string" && !bannedSellerIds.has(sellerId)
    })
    .map((row) => String((row as { id: string }).id))

  const delinquentIds = rows
    .filter((row) => {
      const sellerId = (row as { user_id?: string | null }).user_id
      return typeof sellerId === "string" && bannedSellerIds.has(sellerId)
    })
    .map((row) => String((row as { id: string }).id))

  const relistedIds: string[] = []
  const sellerUserIds: string[] = []

  if (liveIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .update({
        status: "active",
        hidden_from_site: false,
        site_visibility_reason: null,
        updated_at: nowIso,
      })
      .in("id", liveIds)
      .eq("status", "sold")
      .select("id, user_id")

    if (error) {
      console.error("[relist] failed to reactivate listings after refund", {
        listingIds: liveIds,
        error,
      })
    } else {
      for (const row of data ?? []) {
        const id = (row as { id?: string | null }).id
        const sellerId = (row as { user_id?: string | null }).user_id
        if (typeof id === "string" && id.length > 0) relistedIds.push(id)
        if (typeof sellerId === "string" && sellerId.length > 0) sellerUserIds.push(sellerId)
      }
    }
  }

  if (delinquentIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .update({
        status: "delinquent",
        hidden_from_site: true,
        site_visibility_reason: "seller_ban",
        updated_at: nowIso,
      })
      .in("id", delinquentIds)
      .eq("status", "sold")
      .select("id, user_id")

    if (error) {
      console.error("[relist] failed to mark banned-seller refund listings delinquent", {
        listingIds: delinquentIds,
        error,
      })
    } else {
      const restoredDelinquent = (data ?? [])
        .map((row) => (row as { id?: string | null }).id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
      await recordListingVisibilityEvents(
        supabase,
        restoredDelinquent.map((listingId) => ({
          listingId,
          hiddenFromSite: true,
          source: "seller_ban" as const,
          note: "Refund relist while seller banned — kept delinquent",
          metadata: { reason: "refund_seller_banned" },
        })),
      )
      for (const listingId of restoredDelinquent) {
        void syncListingToIndex(supabase, listingId)
      }
      for (const row of data ?? []) {
        const sellerId = (row as { user_id?: string | null }).user_id
        if (typeof sellerId === "string" && sellerId.length > 0) sellerUserIds.push(sellerId)
      }
    }
  }

  revalidateRecentlySoldSurfaces()

  if (relistedIds.length === 0 && delinquentIds.length === 0) {
    return
  }

  if (relistedIds.length > 0) {
    revalidateBoardsBrowseCatalog()
    await revalidateSellersForUserIds(supabase, sellerUserIds)

    await recordListingVisibilityEvents(
      supabase,
      relistedIds.map((listingId) => ({
        listingId,
        hiddenFromSite: false,
        source: "seller_relist" as const,
        note: "Reactivated after refund",
        metadata: { reason: "refund" },
      })),
    )

    for (const listingId of relistedIds) {
      void syncListingToGoogleMerchantBestEffort(supabase, listingId)
      void syncListingToIndex(supabase, listingId)
    }
  } else if (sellerUserIds.length > 0) {
    await revalidateSellersForUserIds(supabase, sellerUserIds)
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
