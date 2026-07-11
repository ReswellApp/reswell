import type { SupabaseClient } from "@supabase/supabase-js"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

export const MARKETPLACE_SALES_MAP_FETCH_CAP = 10_000

const ORDER_SELECT = `
  id,
  amount,
  created_at,
  status,
  fulfillment_method,
  shipping_address,
  buyer_id,
  seller_id,
  listing_id,
  listings:listing_id (
    id,
    title,
    section,
    city,
    state
  )
`

export type MarketplaceSalesMapOrderRow = {
  id: string
  amount: number | string | null
  created_at: string
  status: string | null
  fulfillment_method: string | null
  shipping_address: unknown
  buyer_id: string | null
  seller_id: string | null
  listing_id: string | null
  listings:
    | {
        id: string
        title: string | null
        section: string | null
        city: string | null
        state: string | null
      }
    | {
        id: string
        title: string | null
        section: string | null
        city: string | null
        state: string | null
      }[]
    | null
}

export type MarketplaceSalesMapProfileRow = {
  id: string
  city: string | null
  location: string | null
  default_listing_state: string | null
}

export type MarketplaceMapProfileLocalityRow = {
  id: string
  location: string | null
  default_listing_state: string | null
}

export const MARKETPLACE_MAP_PROFILE_LOCALITY_PAGE_SIZE = 5_000

export type MarketplaceSalesMapListingRow = {
  id: string
  title: string | null
  section: string | null
  city: string | null
  state: string | null
}

export type MarketplaceSalesMapOrderWithListing = MarketplaceSalesMapOrderRow & {
  listing: MarketplaceSalesMapListingRow
}

function unwrapRelation<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

export function normalizeMarketplaceSalesMapOrderRows(
  rows: MarketplaceSalesMapOrderRow[],
): MarketplaceSalesMapOrderWithListing[] {
  const normalized: MarketplaceSalesMapOrderWithListing[] = []

  for (const row of rows) {
    const listing = unwrapRelation(row.listings)
    if (!listing) continue
    if (!listing.section || !PEER_LISTING_SECTIONS_FILTER.includes(listing.section)) continue
    normalized.push({ ...row, listing })
  }

  return normalized
}

export async function fetchConfirmedMarketplaceSalesForMap(
  supabase: SupabaseClient,
): Promise<{
  orders: MarketplaceSalesMapOrderWithListing[]
  profilesById: Map<string, MarketplaceSalesMapProfileRow>
  truncated: boolean
}> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "confirmed")
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .order("created_at", { ascending: false })
    .limit(MARKETPLACE_SALES_MAP_FETCH_CAP)

  if (error) {
    throw new Error(`marketplaceSalesMap orders query failed: ${error.message}`)
  }

  const rawRows = (data ?? []) as MarketplaceSalesMapOrderRow[]
  const orders = normalizeMarketplaceSalesMapOrderRows(rawRows)
  const truncated = rawRows.length >= MARKETPLACE_SALES_MAP_FETCH_CAP

  const profileIds = new Set<string>()
  for (const order of orders) {
    if (order.buyer_id) profileIds.add(order.buyer_id)
    if (order.seller_id) profileIds.add(order.seller_id)
  }

  const profilesById = new Map<string, MarketplaceSalesMapProfileRow>()
  const ids = [...profileIds]
  if (ids.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, city, location, default_listing_state")
      .in("id", ids)

    if (profileError) {
      throw new Error(`marketplaceSalesMap profiles query failed: ${profileError.message}`)
    }

    for (const profile of profileRows ?? []) {
      profilesById.set(String(profile.id), {
        id: String(profile.id),
        city: profile.city != null ? String(profile.city) : null,
        location: profile.location != null ? String(profile.location) : null,
        default_listing_state:
          profile.default_listing_state != null ? String(profile.default_listing_state) : null,
      })
    }
  }

  return { orders, profilesById, truncated }
}

export async function fetchProfileLocalitiesForMap(
  supabase: SupabaseClient,
): Promise<MarketplaceMapProfileLocalityRow[]> {
  const rows: MarketplaceMapProfileLocalityRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, location, default_listing_state")
      .order("id", { ascending: true })
      .range(offset, offset + MARKETPLACE_MAP_PROFILE_LOCALITY_PAGE_SIZE - 1)

    if (error) {
      throw new Error(`marketplaceSalesMap profile localities query failed: ${error.message}`)
    }

    const batch = data ?? []
    for (const row of batch) {
      rows.push({
        id: String(row.id),
        location: row.location != null ? String(row.location) : null,
        default_listing_state:
          row.default_listing_state != null ? String(row.default_listing_state) : null,
      })
    }

    if (batch.length < MARKETPLACE_MAP_PROFILE_LOCALITY_PAGE_SIZE) break
    offset += MARKETPLACE_MAP_PROFILE_LOCALITY_PAGE_SIZE
  }

  return rows
}
