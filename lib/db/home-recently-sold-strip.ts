import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"

/** Matches `/sold` listing filters for surfboards (see `app/sold/page.tsx`). */
export const HOME_RECENTLY_SOLD_STRIP_LIMIT = 12

type RpcListingSaleTime = { listing_id: string; sale_confirmed_at: string }

/** When RPC is missing (migration not deployed), preserves prior behavior. */
async function legacyRecentlySoldOrderingByListingColumns(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ orderedListingIds: string[]; confirmedAtIsoByListingId: Map<string, string> }> {
  const lim = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 40
  const { data, error } = await supabase
    .from("listings")
    .select("id, updated_at")
    .eq("status", "sold")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(lim)

  if (error) {
    console.error("legacyRecentlySoldOrderingByListingColumns:", error.message)
    return { orderedListingIds: [], confirmedAtIsoByListingId: new Map() }
  }

  const orderedListingIds: string[] = []
  const confirmedAtIsoByListingId = new Map<string, string>()
  for (const row of data ?? []) {
    const r = row as { id?: string | null; updated_at?: string | null }
    const id = r.id != null ? String(r.id) : ""
    if (!id) continue
    orderedListingIds.push(id)
    if (r.updated_at) {
      confirmedAtIsoByListingId.set(id, String(r.updated_at))
    }
  }
  return { orderedListingIds, confirmedAtIsoByListingId }
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
    return legacyRecentlySoldOrderingByListingColumns(supabase, limit)
  }

  const rows = (data ?? []) as RpcListingSaleTime[]
  if (rows.length === 0) {
    return { orderedListingIds: [], confirmedAtIsoByListingId: new Map() }
  }

  const orderedListingIds: string[] = []
  const confirmedAtIsoByListingId = new Map<string, string>()
  for (const row of rows) {
    const id = row.listing_id
    const at = row.sale_confirmed_at
    if (typeof id !== "string" || !id) continue
    if (typeof at === "string" && at.length > 0) {
      confirmedAtIsoByListingId.set(id, at)
    }
    orderedListingIds.push(id)
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
