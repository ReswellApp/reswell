import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"
import {
  type SoldFeedSaleRef,
  soldFeedSaleRefFromRpcRow,
} from "@/lib/db/sold-feed-sale-times"
import {
  isListingVisibleAsSoldFeedEntry,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"
import {
  isTransientNetworkError,
  retryOnTransientNetworkError,
} from "@/lib/utils/transient-network-retry"

/** Matches `/sold` sold-tab listing filters — all peer marketplace sections. */
export const MARKETPLACE_SOLD_FEED_SECTIONS = PEER_LISTING_SECTIONS

/** Homepage recently sold strip — surfboards only. */
export const HOME_RECENTLY_SOLD_STRIP_LIMIT = 12

const RECENTLY_SOLD_RPC_MAX_LIMIT = 120
const RECENTLY_SOLD_FALLBACK_ORDER_SCAN = 500

type RpcListingSaleTime = {
  listing_id: string
  order_id?: string | null
  sale_confirmed_at: string
}

function capRecentlySoldLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), RECENTLY_SOLD_RPC_MAX_LIMIT)
}

function isSupabaseRpcMissingError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const message = error.message ?? ""
  return (
    error.code === "PGRST202" ||
    message.includes("Could not find the function") ||
    message.includes("schema cache")
  )
}

function listingSoldFeedVisibilityFields(row: Record<string, unknown>) {
  return {
    title: row.title as string | null | undefined,
    status: String(row.status ?? ""),
    hidden_from_site: row.hidden_from_site as boolean | null | undefined,
    archived_at: row.archived_at as string | null | undefined,
    sync_managed: row.sync_managed as boolean | null | undefined,
  }
}

/** Drop sale refs whose listing no longer qualifies (e.g. P2P refunded and relisted). */
export async function filterSoldFeedSaleRefs(
  supabase: SupabaseClient,
  saleRefs: readonly SoldFeedSaleRef[],
  sections: readonly string[],
): Promise<SoldFeedSaleRef[]> {
  if (saleRefs.length === 0) return []

  const listingIds = [...new Set(saleRefs.map((ref) => ref.listingId))]

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, status, hidden_from_site, archived_at, sync_managed")
    .in("id", listingIds)
    .in("section", [...sections])

  if (error) {
    console.error("filterSoldFeedSaleRefs:", error.message)
    return []
  }

  const eligible = new Set(
    (data ?? [])
      .filter((row) => isListingVisibleAsSoldFeedEntry(listingSoldFeedVisibilityFields(row)))
      .map((row) => (row as { id?: string | null }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  return saleRefs.filter((ref) => eligible.has(ref.listingId))
}

/** Drop ids that are no longer sold (e.g. refunded and relisted to active). Shipped tab only. */
export async function filterListingIdsStillSoldOnMarketplace(
  supabase: SupabaseClient,
  orderedListingIds: readonly string[],
  sections: readonly string[] = ["surfboards"],
): Promise<string[]> {
  if (orderedListingIds.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, status, hidden_from_site, archived_at")
    .in("id", [...orderedListingIds])
    .eq("status", "sold")
    .in("section", [...sections])

  if (error) {
    console.error("filterListingIdsStillSoldOnMarketplace:", error.message)
    return []
  }

  const stillSold = new Set(
    (data ?? [])
      .filter((row) =>
        isListingVisibleInPublicSoldFeed({
          title: (row as { title?: string | null }).title,
          status: String((row as { status?: string | null }).status ?? "sold"),
          hidden_from_site: (row as { hidden_from_site?: boolean | null }).hidden_from_site,
          archived_at: (row as { archived_at?: string | null }).archived_at,
        }),
      )
      .map((row) => (row as { id?: string | null }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  return orderedListingIds.filter((id) => stillSold.has(id))
}

async function finalizeSoldFeedSaleRefs(
  supabase: SupabaseClient,
  rows: RpcListingSaleTime[],
  sections: readonly string[],
): Promise<{ saleRefs: SoldFeedSaleRef[] }> {
  const parsed = rows
    .map((row) => soldFeedSaleRefFromRpcRow(row))
    .filter((ref): ref is SoldFeedSaleRef => ref != null)

  const saleRefs = await filterSoldFeedSaleRefs(supabase, parsed, sections)
  return { saleRefs }
}

async function fetchRecentlySoldSurfboardSaleTimesViaLegacyRpc(
  supabase: SupabaseClient,
  limit: number,
): Promise<RpcListingSaleTime[]> {
  const { data, error } = await retryOnTransientNetworkError(() =>
    supabase.rpc("recently_sold_surfboard_listing_sale_times", {
      p_limit: capRecentlySoldLimit(limit),
    }),
  )

  if (error) {
    if (isTransientNetworkError(error.message)) {
      console.warn(
        `recently_sold_surfboard_listing_sale_times: transient network failure, serving empty strip: ${error.message}`,
      )
    } else {
      console.error("recently_sold_surfboard_listing_sale_times:", error.message)
    }
    return []
  }

  return (data ?? []) as RpcListingSaleTime[]
}

/**
 * App-layer fallback when `recently_sold_listing_sale_times` migration is not applied yet.
 * One row per confirmed checkout, filtered to qualifying peer sections.
 */
async function fetchRecentlySoldListingSaleTimesFallback(
  supabase: SupabaseClient,
  limit: number,
  sections: readonly string[],
): Promise<RpcListingSaleTime[]> {
  const cappedLimit = capRecentlySoldLimit(limit)
  const saleRows: RpcListingSaleTime[] = []

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, listing_id, created_at")
    .eq("status", "confirmed")
    .eq("is_admin_test", false)
    .order("created_at", { ascending: false })
    .limit(RECENTLY_SOLD_FALLBACK_ORDER_SCAN)

  if (ordersError) {
    console.error("[recently-sold-fallback] orders:", ordersError.message)
    return []
  }

  const orderCreatedAt = new Map<string, string>()
  const orderIdsNeedingItems: string[] = []

  for (const row of orders ?? []) {
    const orderId = (row as { id?: string | null }).id
    const createdAt = (row as { created_at?: string | null }).created_at
    const listingId = (row as { listing_id?: string | null }).listing_id
    if (typeof orderId !== "string" || !orderId) continue
    if (typeof createdAt !== "string" || !createdAt) continue
    orderCreatedAt.set(orderId, createdAt)

    if (typeof listingId === "string" && listingId) {
      saleRows.push({
        listing_id: listingId,
        order_id: orderId,
        sale_confirmed_at: createdAt,
      })
    } else {
      orderIdsNeedingItems.push(orderId)
    }
  }

  if (orderIdsNeedingItems.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("listing_id, order_id")
      .in("order_id", orderIdsNeedingItems)

    if (itemsError) {
      console.error("[recently-sold-fallback] order_items:", itemsError.message)
    } else {
      for (const item of items ?? []) {
        const listingId = (item as { listing_id?: string | null }).listing_id
        const orderId = (item as { order_id?: string | null }).order_id
        if (typeof listingId !== "string" || !listingId) continue
        if (typeof orderId !== "string" || !orderId) continue
        const saleAt = orderCreatedAt.get(orderId)
        if (!saleAt) continue
        saleRows.push({
          listing_id: listingId,
          order_id: orderId,
          sale_confirmed_at: saleAt,
        })
      }
    }
  }

  const candidateIds = [...new Set(saleRows.map((row) => row.listing_id))]
  if (candidateIds.length === 0) return []

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, status, hidden_from_site, archived_at, sync_managed")
    .in("id", candidateIds)
    .in("section", [...sections])

  if (listingsError) {
    console.error("[recently-sold-fallback] listings:", listingsError.message)
    return []
  }

  const validIds = new Set(
    (listings ?? [])
      .filter((row) => isListingVisibleAsSoldFeedEntry(listingSoldFeedVisibilityFields(row)))
      .map((row) => (row as { id?: string | null }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  const qualifying = saleRows.filter((row) => validIds.has(row.listing_id))
  qualifying.sort((a, b) => b.sale_confirmed_at.localeCompare(a.sale_confirmed_at))
  return qualifying.slice(0, cappedLimit)
}

/**
 * Ordering + confirmation timestamps from confirmed marketplace orders (Stripe card or wallet).
 * Returns one ref per checkout — the same listing may appear multiple times for inventory sales.
 */
export async function fetchRecentlySoldListingsConfirmedCheckoutOrdering(
  supabase: SupabaseClient,
  limit: number,
  sections: readonly string[],
): Promise<{ saleRefs: SoldFeedSaleRef[] }> {
  const { data, error } = await retryOnTransientNetworkError(() =>
    supabase.rpc("recently_sold_listing_sale_times", {
      p_limit: capRecentlySoldLimit(limit),
      p_sections: [...sections],
    }),
  )

  if (!error) {
    return finalizeSoldFeedSaleRefs(supabase, (data ?? []) as RpcListingSaleTime[], sections)
  }

  if (!isSupabaseRpcMissingError(error)) {
    if (isTransientNetworkError(error.message)) {
      console.warn(
        `recently_sold_listing_sale_times: transient network failure, serving empty feed: ${error.message}`,
      )
    } else {
      console.error("recently_sold_listing_sale_times:", error.message)
    }
    return { saleRefs: [] }
  }

  const surfboardsOnly = sections.length === 1 && sections[0] === "surfboards"
  const rows = surfboardsOnly
    ? await fetchRecentlySoldSurfboardSaleTimesViaLegacyRpc(supabase, limit)
    : await fetchRecentlySoldListingSaleTimesFallback(supabase, limit, sections)

  return finalizeSoldFeedSaleRefs(supabase, rows, sections)
}

/** Surfboards-only variant for the homepage recently sold strip. */
export async function fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ saleRefs: SoldFeedSaleRef[] }> {
  return fetchRecentlySoldListingsConfirmedCheckoutOrdering(supabase, limit, ["surfboards"])
}

/** One listing id per sale ref, preserving newest-first order (homepage strip). */
export function dedupeSoldFeedSaleRefsByListing(
  saleRefs: readonly SoldFeedSaleRef[],
  maxListings: number,
): { listingIds: string[]; confirmedAtIsoByListingId: Map<string, string> } {
  const listingIds: string[] = []
  const confirmedAtIsoByListingId = new Map<string, string>()
  const seen = new Set<string>()

  for (const ref of saleRefs) {
    if (seen.has(ref.listingId)) continue
    seen.add(ref.listingId)
    listingIds.push(ref.listingId)
    confirmedAtIsoByListingId.set(ref.listingId, ref.saleConfirmedAt)
    if (listingIds.length >= maxListings) break
  }

  return { listingIds, confirmedAtIsoByListingId }
}

/** Homepage strip: listings with Stripe or wallet checkout in `confirmed` status only. */
export async function fetchHomeRecentlySoldSurfboardRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const { saleRefs } = await fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(
    supabase,
    HOME_RECENTLY_SOLD_STRIP_LIMIT * 3,
  )
  const { listingIds: orderedListingIds } = dedupeSoldFeedSaleRefsByListing(
    saleRefs,
    HOME_RECENTLY_SOLD_STRIP_LIMIT,
  )
  if (orderedListingIds.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(`${HOME_PEER_LISTING_WITH_PROFILE_SELECT}, hidden_from_site, archived_at, sync_managed`)
    .in("id", orderedListingIds)

  if (error) {
    console.error("fetchHomeRecentlySoldSurfboardRows:", error.message)
    return []
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const byId = new Map(rows.map((r) => [String(r.id), r]))

  const ordered: Record<string, unknown>[] = []
  for (const id of orderedListingIds) {
    const row = byId.get(id)
    if (!row) continue
    if (!isListingVisibleAsSoldFeedEntry(listingSoldFeedVisibilityFields(row))) {
      continue
    }
    ordered.push(row)
  }
  return ordered
}
