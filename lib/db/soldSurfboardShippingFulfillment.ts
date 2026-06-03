import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { filterListingIdsStillSoldOnMarketplace } from "@/lib/db/home-recently-sold-strip"

type SaleLine = { listingId: string; saleAt: string }

type OrderItemRow = {
  listing_id: string
  orders: { created_at: string; status: string; fulfillment_method: string | null } | null
}

function serviceClientOrNull(): SupabaseClient | null {
  try {
    return createServiceRoleClient()
  } catch (error) {
    console.error("[soldSurfboardShippingFulfillment] service role unavailable:", error)
    return null
  }
}

async function fetchConfirmedShippingSaleLines(
  svc: SupabaseClient,
  listingIdFilter?: readonly string[],
): Promise<SaleLine[]> {
  const lines: SaleLine[] = []
  const cappedFilter = listingIdFilter?.length ? [...new Set(listingIdFilter)] : undefined

  let ordersQuery = svc
    .from("orders")
    .select("listing_id, created_at")
    .eq("status", "confirmed")
    .eq("fulfillment_method", "shipping")
    .order("created_at", { ascending: false })

  if (cappedFilter?.length) {
    ordersQuery = ordersQuery.in("listing_id", cappedFilter)
  }

  const { data: orders, error: ordersError } = await ordersQuery.limit(cappedFilter ? 500 : 200)
  if (ordersError) {
    console.error("[soldSurfboardShippingFulfillment] orders:", ordersError.message)
  } else {
    for (const row of orders ?? []) {
      const listingId = (row as { listing_id?: string | null }).listing_id
      const saleAt = (row as { created_at?: string | null }).created_at
      if (typeof listingId === "string" && listingId && typeof saleAt === "string" && saleAt) {
        lines.push({ listingId, saleAt })
      }
    }
  }

  let itemsQuery = svc
    .from("order_items")
    .select("listing_id, orders!inner(created_at, status, fulfillment_method)")
    .eq("orders.status", "confirmed")
    .eq("orders.fulfillment_method", "shipping")

  if (cappedFilter?.length) {
    itemsQuery = itemsQuery.in("listing_id", cappedFilter)
  }

  const { data: items, error: itemsError } = await itemsQuery.limit(cappedFilter ? 500 : 200)
  if (itemsError) {
    console.error("[soldSurfboardShippingFulfillment] order_items:", itemsError.message)
  } else {
    for (const row of (items ?? []) as OrderItemRow[]) {
      const listingId = row.listing_id
      const order = row.orders
      const saleAt = order?.created_at
      if (typeof listingId === "string" && listingId && typeof saleAt === "string" && saleAt) {
        lines.push({ listingId, saleAt })
      }
    }
  }

  return lines
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
 * Confirmed surfboard sales where checkout fulfillment was shipping.
 * Reads orders via service role (RLS blocks anon/authenticated on `orders`).
 */
export async function fetchRecentlyShippedSurfboardsConfirmedCheckoutOrdering(
  supabase: SupabaseClient,
  limit: number,
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

  const orderedListingIds = await filterListingIdsStillSoldOnMarketplace(
    supabase,
    rpcOrderedListingIds,
  )

  const confirmedAtIsoByListingId = new Map<string, string>()
  for (const id of orderedListingIds) {
    const at = latestByListingId.get(id)
    if (at) confirmedAtIsoByListingId.set(id, at)
  }

  return {
    orderedListingIds: orderedListingIds.slice(0, limit),
    confirmedAtIsoByListingId,
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
