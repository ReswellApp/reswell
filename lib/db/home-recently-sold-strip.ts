import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"

/** Matches `/sold` listing filters for surfboards (see `app/sold/page.tsx`). */
export const HOME_RECENTLY_SOLD_STRIP_LIMIT = 12

type RpcListingSaleTime = { listing_id: string; sale_confirmed_at: string }

/** Drop ids that are no longer sold (e.g. refunded and relisted to active). */
export async function filterListingIdsStillSoldOnMarketplace(
  supabase: SupabaseClient,
  orderedListingIds: readonly string[],
): Promise<string[]> {
  if (orderedListingIds.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .in("id", [...orderedListingIds])
    .eq("status", "sold")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .is("archived_at", null)

  if (error) {
    console.error("filterListingIdsStillSoldOnMarketplace:", error.message)
    return []
  }

  const stillSold = new Set(
    (data ?? [])
      .map((row) => (row as { id?: string | null }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  return orderedListingIds.filter((id) => stillSold.has(id))
}

/**
 * Ordering + confirmation timestamps from confirmed marketplace orders (Stripe card or wallet).
 * Single RPC call — reuse for homepage strip and `/sold`.
 */
export async function fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ orderedListingIds: string[]; confirmedAtIsoByListingId: Map<string, string> }> {
  const { data, error } = await supabase.rpc("recently_sold_surfboard_listing_sale_times", {
    p_limit: limit,
  })

  if (error) {
    console.error("recently_sold_surfboard_listing_sale_times:", error.message)
    return { orderedListingIds: [], confirmedAtIsoByListingId: new Map() }
  }

  const rows = (data ?? []) as RpcListingSaleTime[]
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
  )
  for (const id of [...confirmedAtIsoByListingId.keys()]) {
    if (!orderedListingIds.includes(id)) {
      confirmedAtIsoByListingId.delete(id)
    }
  }

  return { orderedListingIds, confirmedAtIsoByListingId }
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
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
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
    if (row) ordered.push(row)
  }
  return ordered
}
