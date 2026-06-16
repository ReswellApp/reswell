import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"
import { isListingVisibleInPublicSoldFeed } from "@/lib/listing-public-visibility"
import {
  isTransientNetworkError,
  retryOnTransientNetworkError,
} from "@/lib/utils/transient-network-retry"

/** Matches `/sold` sold-tab listing filters (surfboards + fins). */
export const MARKETPLACE_SOLD_FEED_SECTIONS = ["surfboards", "fins"] as const

/** Homepage recently sold strip — surfboards only. */
export const HOME_RECENTLY_SOLD_STRIP_LIMIT = 12

const RECENTLY_SOLD_RPC_MAX_LIMIT = 120
const RECENTLY_SOLD_FALLBACK_ORDER_SCAN = 500

type RpcListingSaleTime = { listing_id: string; sale_confirmed_at: string }

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

/** Drop ids that are no longer sold (e.g. refunded and relisted to active). */
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

async function finalizeRecentSoldOrdering(
  supabase: SupabaseClient,
  rows: RpcListingSaleTime[],
  sections: readonly string[],
): Promise<{ orderedListingIds: string[]; confirmedAtIsoByListingId: Map<string, string> }> {
  if (rows.length === 0) {
    return { orderedListingIds: [], confirmedAtIsoByListingId: new Map() }
  }

  const rpcOrderedListingIds: string[] = []
  const confirmedAtIsoByListingId = new Map<string, string>()
  for (const row of rows) {
    const id = row.listing_id
    const at = row.sale_confirmed_at
    if (typeof id !== "string" || !id) continue
    if (typeof at === "string" && at.length > 0) {
      confirmedAtIsoByListingId.set(id, at)
    }
    rpcOrderedListingIds.push(id)
  }

  const orderedListingIds = await filterListingIdsStillSoldOnMarketplace(
    supabase,
    rpcOrderedListingIds,
    sections,
  )
  for (const id of [...confirmedAtIsoByListingId.keys()]) {
    if (!orderedListingIds.includes(id)) {
      confirmedAtIsoByListingId.delete(id)
    }
  }

  return { orderedListingIds, confirmedAtIsoByListingId }
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
 * Mirrors the RPC: confirmed checkout order time per listing, filtered to sold peer sections.
 */
async function fetchRecentlySoldListingSaleTimesFallback(
  supabase: SupabaseClient,
  limit: number,
  sections: readonly string[],
): Promise<RpcListingSaleTime[]> {
  const cappedLimit = capRecentlySoldLimit(limit)
  const saleAtByListingId = new Map<string, string>()

  const recordSale = (listingId: string | null | undefined, createdAt: string | null | undefined) => {
    if (typeof listingId !== "string" || !listingId) return
    if (typeof createdAt !== "string" || !createdAt) return
    const prev = saleAtByListingId.get(listingId)
    if (!prev || createdAt > prev) {
      saleAtByListingId.set(listingId, createdAt)
    }
  }

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
    if (typeof createdAt === "string" && createdAt) {
      orderCreatedAt.set(orderId, createdAt)
    }
    if (typeof listingId === "string" && listingId) {
      recordSale(listingId, createdAt ?? null)
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
        recordSale(listingId, typeof orderId === "string" ? orderCreatedAt.get(orderId) : undefined)
      }
    }
  }

  const candidateIds = [...saleAtByListingId.keys()]
  if (candidateIds.length === 0) return []

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, status, hidden_from_site, archived_at")
    .in("id", candidateIds)
    .in("section", [...sections])
    .eq("status", "sold")

  if (listingsError) {
    console.error("[recently-sold-fallback] listings:", listingsError.message)
    return []
  }

  const validIds = new Set(
    (listings ?? [])
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

  const rows: RpcListingSaleTime[] = []
  for (const [listingId, saleConfirmedAt] of saleAtByListingId) {
    if (!validIds.has(listingId)) continue
    rows.push({ listing_id: listingId, sale_confirmed_at: saleConfirmedAt })
  }

  rows.sort((a, b) => b.sale_confirmed_at.localeCompare(a.sale_confirmed_at))
  return rows.slice(0, cappedLimit)
}

/**
 * Ordering + confirmation timestamps from confirmed marketplace orders (Stripe card or wallet).
 * Uses the multi-section RPC when migrated; falls back to legacy surfboard RPC or app queries.
 */
export async function fetchRecentlySoldListingsConfirmedCheckoutOrdering(
  supabase: SupabaseClient,
  limit: number,
  sections: readonly string[],
): Promise<{ orderedListingIds: string[]; confirmedAtIsoByListingId: Map<string, string> }> {
  const { data, error } = await retryOnTransientNetworkError(() =>
    supabase.rpc("recently_sold_listing_sale_times", {
      p_limit: capRecentlySoldLimit(limit),
      p_sections: [...sections],
    }),
  )

  if (!error) {
    return finalizeRecentSoldOrdering(supabase, (data ?? []) as RpcListingSaleTime[], sections)
  }

  if (!isSupabaseRpcMissingError(error)) {
    if (isTransientNetworkError(error.message)) {
      console.warn(
        `recently_sold_listing_sale_times: transient network failure, serving empty feed: ${error.message}`,
      )
    } else {
      console.error("recently_sold_listing_sale_times:", error.message)
    }
    return { orderedListingIds: [], confirmedAtIsoByListingId: new Map() }
  }

  const surfboardsOnly = sections.length === 1 && sections[0] === "surfboards"
  const rows = surfboardsOnly
    ? await fetchRecentlySoldSurfboardSaleTimesViaLegacyRpc(supabase, limit)
    : await fetchRecentlySoldListingSaleTimesFallback(supabase, limit, sections)

  return finalizeRecentSoldOrdering(supabase, rows, sections)
}

/** Surfboards-only variant for the homepage recently sold strip (legacy RPC). */
export async function fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ orderedListingIds: string[]; confirmedAtIsoByListingId: Map<string, string> }> {
  const rows = await fetchRecentlySoldSurfboardSaleTimesViaLegacyRpc(supabase, limit)
  return finalizeRecentSoldOrdering(supabase, rows, ["surfboards"])
}

/** Homepage strip: listings with Stripe or wallet checkout in `confirmed` status only. */
export async function fetchHomeRecentlySoldSurfboardRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const { orderedListingIds } = await fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(
    supabase,
    HOME_RECENTLY_SOLD_STRIP_LIMIT,
  )
  if (orderedListingIds.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(`${HOME_PEER_LISTING_WITH_PROFILE_SELECT}, hidden_from_site, archived_at`)
    .in("id", orderedListingIds)
    .eq("status", "sold")

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
    if (
      !isListingVisibleInPublicSoldFeed({
        title: row.title as string | null | undefined,
        status: String(row.status ?? "sold"),
        hidden_from_site: row.hidden_from_site as boolean | null | undefined,
        archived_at: row.archived_at as string | null | undefined,
      })
    ) {
      continue
    }
    ordered.push(row)
  }
  return ordered
}
