import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { markListingSoldForCheckout } from "@/lib/services/listingSoldSiteEffects"

type ActiveListingWithConfirmedOrder = {
  listingId: string
  slug: string | null
  sellerUserId: string
  soldPriceUsd: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const RECONCILE_ORDER_SCAN = 250

async function findListingIdsFromRecentConfirmedOrders(
  service: SupabaseClient,
): Promise<Map<string, number>> {
  const salePriceByListingId = new Map<string, number>()

  const recordSalePrice = (listingId: string | null | undefined, amount: unknown) => {
    if (typeof listingId !== "string" || !listingId) return
    const parsed = round2(Number(amount))
    if (!Number.isFinite(parsed) || parsed <= 0) return
    salePriceByListingId.set(listingId, parsed)
  }

  const { data: orders, error: ordersErr } = await service
    .from("orders")
    .select("id, listing_id, amount")
    .eq("status", "confirmed")
    .eq("is_admin_test", false)
    .in("sales_channel", ["online", "pos"])
    .order("created_at", { ascending: false })
    .limit(RECONCILE_ORDER_SCAN)

  if (ordersErr) {
    console.error("[reconcileListingSoldOrders] recent orders query failed", ordersErr)
    return salePriceByListingId
  }

  const orderIdsNeedingItems: string[] = []
  for (const row of orders ?? []) {
    const listingId = (row as { listing_id?: string | null }).listing_id
    const amount = (row as { amount?: string | number | null }).amount
    if (typeof listingId === "string" && listingId) {
      recordSalePrice(listingId, amount)
    } else {
      const orderId = (row as { id?: string | null }).id
      if (typeof orderId === "string" && orderId) orderIdsNeedingItems.push(orderId)
    }
  }

  if (orderIdsNeedingItems.length > 0) {
    const { data: items, error: itemsErr } = await service
      .from("order_items")
      .select("listing_id, item_price, order_id")
      .in("order_id", orderIdsNeedingItems)

    if (itemsErr) {
      console.error("[reconcileListingSoldOrders] recent order_items query failed", itemsErr)
    } else {
      const amountByOrderId = new Map(
        (orders ?? [])
          .map((row) => {
            const orderId = (row as { id?: string | null }).id
            const amount = (row as { amount?: string | number | null }).amount
            return typeof orderId === "string" && orderId
              ? ([orderId, amount] as const)
              : null
          })
          .filter((entry): entry is readonly [string, string | number | null] => entry != null),
      )

      for (const row of items ?? []) {
        const listingId = (row as { listing_id?: string | null }).listing_id
        const itemPrice = (row as { item_price?: string | number | null }).item_price
        const orderId = (row as { order_id?: string | null }).order_id
        recordSalePrice(
          listingId,
          itemPrice ??
            (typeof orderId === "string" ? amountByOrderId.get(orderId) : undefined),
        )
      }
    }
  }

  return salePriceByListingId
}

async function findActiveListingsWithConfirmedOrders(
  service: SupabaseClient,
  options?: { storeId?: string; listingIds?: readonly string[] },
): Promise<ActiveListingWithConfirmedOrder[]> {
  const storeId = options?.storeId?.trim()
  const listingIds = options?.listingIds?.filter((id) => id.length > 0) ?? []

  if (listingIds.length === 0 && !storeId) {
    const salePriceByListingId = await findListingIdsFromRecentConfirmedOrders(service)
    const candidateIds = [...salePriceByListingId.keys()]
    if (candidateIds.length === 0) return []

    const { data: activeListings, error: listingsErr } = await service
      .from("listings")
      .select("id, slug, user_id, price")
      .in("id", candidateIds)
      .eq("status", "active")

    if (listingsErr) {
      console.error("[reconcileListingSoldOrders] active listings by order failed", listingsErr)
      return []
    }

    return (activeListings ?? []).map((row) => {
      const listing = row as {
        id: string
        slug: string | null
        user_id: string
        price: string | number
      }
      return {
        listingId: listing.id,
        slug: listing.slug,
        sellerUserId: listing.user_id,
        soldPriceUsd:
          salePriceByListingId.get(listing.id) ??
          round2(Number.parseFloat(String(listing.price))),
      }
    })
  }

  let listingsQuery = service
    .from("listings")
    .select("id, slug, user_id, price, consignment_store_id")
    .eq("status", "active")

  if (storeId) {
    listingsQuery = listingsQuery.eq("consignment_store_id", storeId)
  }
  if (listingIds.length > 0) {
    listingsQuery = listingsQuery.in("id", [...listingIds])
  }

  const { data: activeListings, error: listingsErr } = await listingsQuery
  if (listingsErr) {
    console.error("[reconcileListingSoldOrders] active listings query failed", listingsErr)
    return []
  }

  const activeRows = (activeListings ?? []) as {
    id: string
    slug: string | null
    user_id: string
    price: string | number
    consignment_store_id: string | null
  }[]
  if (activeRows.length === 0) return []

  const activeIds = activeRows.map((row) => row.id)
  const salePriceByListingId = new Map<string, number>()

  const recordSalePrice = (listingId: string | null | undefined, amount: unknown) => {
    if (typeof listingId !== "string" || !listingId) return
    if (!activeIds.includes(listingId)) return
    const parsed = round2(Number(amount))
    if (!Number.isFinite(parsed) || parsed <= 0) return
    salePriceByListingId.set(listingId, parsed)
  }

  const { data: orderItems, error: itemsErr } = await service
    .from("order_items")
    .select("listing_id, item_price, orders!inner(status, is_admin_test, sales_channel)")
    .in("listing_id", activeIds)
    .eq("orders.status", "confirmed")
    .eq("orders.is_admin_test", false)
    .in("orders.sales_channel", ["online", "pos"])

  if (itemsErr) {
    console.error("[reconcileListingSoldOrders] order_items query failed", itemsErr)
  } else {
    for (const row of orderItems ?? []) {
      const listingId = (row as { listing_id?: string | null }).listing_id
      const itemPrice = (row as { item_price?: string | number | null }).item_price
      recordSalePrice(listingId, itemPrice)
    }
  }

  const { data: legacyOrders, error: legacyErr } = await service
    .from("orders")
    .select("listing_id, amount")
    .in("listing_id", activeIds)
    .eq("status", "confirmed")
    .eq("is_admin_test", false)
    .in("sales_channel", ["online", "pos"])

  if (legacyErr) {
    console.error("[reconcileListingSoldOrders] legacy orders query failed", legacyErr)
  } else {
    for (const row of legacyOrders ?? []) {
      recordSalePrice(
        (row as { listing_id?: string | null }).listing_id,
        (row as { amount?: string | number | null }).amount,
      )
    }
  }

  return activeRows
    .filter((row) => salePriceByListingId.has(row.id))
    .map((row) => ({
      listingId: row.id,
      slug: row.slug,
      sellerUserId: row.user_id,
      soldPriceUsd:
        salePriceByListingId.get(row.id) ??
        round2(Number.parseFloat(String(row.price))),
    }))
}

/**
 * Mark active listings sold when a confirmed checkout order already exists.
 * Repairs partial POS / checkout failures where the order settled but status stayed active.
 */
export async function reconcileActiveListingsWithConfirmedOrders(
  service: SupabaseClient,
  options?: { storeId?: string; listingIds?: readonly string[] },
): Promise<number> {
  const candidates = await findActiveListingsWithConfirmedOrders(service, options)
  if (candidates.length === 0) return 0

  let repaired = 0
  for (const candidate of candidates) {
    const marked = await markListingSoldForCheckout(service, {
      listingId: candidate.listingId,
      listingSlug: candidate.slug,
      sellerUserId: candidate.sellerUserId,
      soldPriceUsd: candidate.soldPriceUsd,
    })
    if (marked.ok) {
      repaired += 1
    } else {
      console.error("[reconcileListingSoldOrders] mark sold failed", {
        listingId: candidate.listingId,
        error: marked.error,
      })
    }
  }
  return repaired
}

/** Store hub: best-effort repair for floor inventory with settled orders. */
export async function reconcileStoreInventorySoldOrders(storeId: string): Promise<number> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return 0
  }
  return reconcileActiveListingsWithConfirmedOrders(service, { storeId })
}

/** Public sold feed: repair recent checkout/POS orders whose listings stayed active. */
export async function reconcileMarketplaceSoldFeedOrders(): Promise<number> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return 0
  }
  return reconcileActiveListingsWithConfirmedOrders(service)
}

/** POS finalize / webhook idempotency: ensure the sold listing matches the settled order. */
export async function ensurePosOrderListingMarkedSold(
  service: SupabaseClient,
  listing: {
    id: string
    slug: string | null
    user_id: string
    price: string | number
  },
  soldPriceUsd: number,
): Promise<void> {
  const marked = await markListingSoldForCheckout(service, {
    listingId: listing.id,
    listingSlug: listing.slug,
    sellerUserId: listing.user_id,
    soldPriceUsd,
  })
  if (marked.ok) return

  const repaired = await reconcileActiveListingsWithConfirmedOrders(service, {
    listingIds: [listing.id],
  })
  if (repaired > 0) return

  console.error("[ensurePosOrderListingMarkedSold] could not mark listing sold", {
    listingId: listing.id,
    error: marked.error,
  })
}
