import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { filterListingIdsStillSoldOnMarketplace } from "@/lib/db/home-recently-sold-strip"

type SaleLine = { listingId: string; saleAt: string }

type OrderItemRow = {
  listing_id: string
  orders: { created_at: string; status: string; fulfillment_method: string | null } | null
}

const SHIPPING_SALE_SCAN_PAGE = 500
const SHIPPING_SALE_SCAN_MAX = 5000
const STILL_SOLD_ID_BATCH = 150

function serviceClientOrNull(): SupabaseClient | null {
  try {
    return createServiceRoleClient()
  } catch (error) {
    console.error("[soldSurfboardShippingFulfillment] service role unavailable:", error)
    return null
  }
}

function pushSaleLine(
  lines: SaleLine[],
  listingId: unknown,
  saleAt: unknown,
): void {
  if (typeof listingId === "string" && listingId && typeof saleAt === "string" && saleAt) {
    lines.push({ listingId, saleAt })
  }
}

async function scanConfirmedShippingSaleLines(
  fetchPage: (from: number, to: number) => Promise<SaleLine[]>,
): Promise<SaleLine[]> {
  const lines: SaleLine[] = []
  for (let offset = 0; offset < SHIPPING_SALE_SCAN_MAX; offset += SHIPPING_SALE_SCAN_PAGE) {
    const page = await fetchPage(offset, offset + SHIPPING_SALE_SCAN_PAGE - 1)
    lines.push(...page)
    if (page.length < SHIPPING_SALE_SCAN_PAGE) break
  }
  return lines
}

async function fetchConfirmedShippingSaleLines(
  svc: SupabaseClient,
  listingIdFilter?: readonly string[],
): Promise<SaleLine[]> {
  const cappedFilter = listingIdFilter?.length ? [...new Set(listingIdFilter)] : undefined

  const fromOrders = await scanConfirmedShippingSaleLines(async (from, to) => {
    const lines: SaleLine[] = []
    let query = svc
      .from("orders")
      .select("listing_id, created_at")
      .eq("status", "confirmed")
      .eq("fulfillment_method", "shipping")
      .order("created_at", { ascending: false })
      .range(from, to)
    if (cappedFilter?.length) {
      query = query.in("listing_id", cappedFilter)
    }
    const { data, error } = await query
    if (error) {
      console.error("[soldSurfboardShippingFulfillment] orders:", error.message)
      return lines
    }
    for (const row of data ?? []) {
      pushSaleLine(
        lines,
        (row as { listing_id?: string | null }).listing_id,
        (row as { created_at?: string | null }).created_at,
      )
    }
    return lines
  })

  const fromItems = await scanConfirmedShippingSaleLines(async (from, to) => {
    const lines: SaleLine[] = []
    let query = svc
      .from("order_items")
      .select("listing_id, orders!inner(created_at, status, fulfillment_method)")
      .eq("orders.status", "confirmed")
      .eq("orders.fulfillment_method", "shipping")
      .order("listing_id", { ascending: true })
      .range(from, to)
    if (cappedFilter?.length) {
      query = query.in("listing_id", cappedFilter)
    }
    const { data, error } = await query
    if (error) {
      console.error("[soldSurfboardShippingFulfillment] order_items:", error.message)
      return lines
    }
    for (const row of (data ?? []) as OrderItemRow[]) {
      pushSaleLine(lines, row.listing_id, row.orders?.created_at)
    }
    return lines
  })

  return [...fromOrders, ...fromItems]
}

async function filterStillSoldSurfboardIdsInOrder(
  supabase: SupabaseClient,
  orderedListingIds: readonly string[],
): Promise<string[]> {
  const stillSold: string[] = []
  for (let i = 0; i < orderedListingIds.length; i += STILL_SOLD_ID_BATCH) {
    const batch = orderedListingIds.slice(i, i + STILL_SOLD_ID_BATCH)
    stillSold.push(...(await filterListingIdsStillSoldOnMarketplace(supabase, batch)))
  }
  return stillSold
}

function latestSaleAtByListingId(lines: readonly SaleLine[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const { listingId, saleAt } of lines) {
    const prev = map.get(listingId)
    if (!prev || saleAt > prev) {
      map.set(listingId, saleAt)
    }
  }
  return map
}

/**
 * All confirmed surfboard sales where checkout fulfillment was shipping,
 * newest first. Reads orders via service role (RLS blocks anon/authenticated).
 */
export async function fetchShippedSurfboardSaleOrdering(
  supabase: SupabaseClient,
): Promise<{ orderedListingIds: string[]; confirmedAtIsoByListingId: Map<string, string> }> {
  const svc = serviceClientOrNull()
  if (!svc) {
    return { orderedListingIds: [], confirmedAtIsoByListingId: new Map() }
  }

  const latestByListingId = latestSaleAtByListingId(await fetchConfirmedShippingSaleLines(svc))
  if (latestByListingId.size === 0) {
    return { orderedListingIds: [], confirmedAtIsoByListingId: new Map() }
  }

  const rpcOrderedListingIds = [...latestByListingId.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([listingId]) => listingId)

  const orderedListingIds = await filterStillSoldSurfboardIdsInOrder(
    supabase,
    rpcOrderedListingIds,
  )

  const confirmedAtIsoByListingId = new Map<string, string>()
  for (const id of orderedListingIds) {
    const at = latestByListingId.get(id)
    if (at) confirmedAtIsoByListingId.set(id, at)
  }

  return { orderedListingIds, confirmedAtIsoByListingId }
}

/**
 * Newest confirmed shipped surfboards, capped for compact surfaces
 * (homepage-style strips). Prefer {@link fetchShippedSurfboardSaleOrdering} for /sold pagination.
 */
export async function fetchRecentlyShippedSurfboardsConfirmedCheckoutOrdering(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ orderedListingIds: string[]; confirmedAtIsoByListingId: Map<string, string> }> {
  const full = await fetchShippedSurfboardSaleOrdering(supabase)
  return {
    orderedListingIds: full.orderedListingIds.slice(0, limit),
    confirmedAtIsoByListingId: full.confirmedAtIsoByListingId,
  }
}

/** Sold surfboard listing ids from the input set that used shipping at checkout. */
export async function fetchSoldSurfboardListingIdsWithShippingFulfillment(
  listingIds: readonly string[],
): Promise<Set<string>> {
  const ids = [...new Set(listingIds.filter((id) => typeof id === "string" && id.length > 0))]
  if (ids.length === 0) return new Set()

  const svc = serviceClientOrNull()
  if (!svc) return new Set()

  const latestByListingId = latestSaleAtByListingId(
    await fetchConfirmedShippingSaleLines(svc, ids),
  )
  return new Set(latestByListingId.keys())
}

export async function soldSurfboardListingUsedShippingFulfillment(
  listingId: string,
): Promise<boolean> {
  const ids = await fetchSoldSurfboardListingIdsWithShippingFulfillment([listingId])
  return ids.has(listingId)
}
