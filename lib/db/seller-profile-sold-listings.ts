import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

export type SellerProfileSoldListingRef = {
  listingId: string
  lastSoldAt: string | null
}

export type SellerProfileSoldSaleMeta = {
  quantitySold: number
  soldPrice: number | null
  soldAt: string | null
}

/** PostgREST: `listings.last_sold_at` not migrated yet. */
export function isListingLastSoldAtColumnMissing(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  const message = error.message ?? ""
  return (
    message.includes("last_sold_at") &&
    (message.includes("column") ||
      message.includes("schema cache") ||
      error.code === "PGRST204" ||
      error.code === "42703")
  )
}

/** PostgREST: interim RPC not in schema cache (or already dropped after denorm). */
export function isSellerProfileSoldListingRpcMissing(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  const message = error.message ?? ""
  return (
    error.code === "PGRST202" ||
    (message.includes("seller_profile_sold_listing_ids") &&
      (message.includes("Could not find the function") || message.includes("schema cache")))
  )
}

function parseSoldAt(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function parseQuantity(value: unknown): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseMoney(value: unknown): number | null {
  if (value == null || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mergeSoldRefs(
  rows: Array<{ id?: unknown; last_sold_at?: unknown }>,
  limit: number,
): SellerProfileSoldListingRef[] {
  const byId = new Map<string, SellerProfileSoldListingRef>()
  for (const row of rows) {
    const listingId = typeof row.id === "string" ? row.id : ""
    if (!listingId) continue
    const lastSoldAt = parseSoldAt(row.last_sold_at)
    const existing = byId.get(listingId)
    if (
      !existing ||
      (lastSoldAt != null &&
        (existing.lastSoldAt == null || lastSoldAt > existing.lastSoldAt))
    ) {
      byId.set(listingId, { listingId, lastSoldAt })
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      const aAt = a.lastSoldAt ?? ""
      const bAt = b.lastSoldAt ?? ""
      if (aAt !== bAt) return bAt.localeCompare(aAt)
      return b.listingId.localeCompare(a.listingId)
    })
    .slice(0, limit)
}

async function serviceOrFallback(supabase: SupabaseClient): Promise<SupabaseClient> {
  try {
    // Lazy import keeps pure helper unit tests free of server/supabase SSR deps.
    const { createServiceRoleClient } = await import("@/lib/supabase/server")
    return createServiceRoleClient()
  } catch {
    return supabase
  }
}

/**
 * When `last_sold_at` and the interim RPC are both unavailable, rebuild Sold-tab
 * eligibility from confirmed checkouts (service role) so leftover-stock sales
 * still appear — same rules as the dropped RPC.
 */
async function fetchSoldRefsFromOrdersFallback(
  supabase: SupabaseClient,
  sellerId: string,
  limit: number,
): Promise<SellerProfileSoldListingRef[]> {
  const client = await serviceOrFallback(supabase)

  const { data: sellerListings, error: listingsError } = await client
    .from("listings")
    .select("id, status, hidden_from_site, archived_at, updated_at, created_at")
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .not("title", "ilike", "Admin seed%")

  if (listingsError) {
    console.error(
      "[seller-profile-sold-listings] order fallback listings:",
      listingsError.message,
    )
    return []
  }

  const listingById = new Map(
    (sellerListings ?? []).map((row) => [String((row as { id: string }).id), row]),
  )
  if (listingById.size === 0) return []

  const listingIds = [...listingById.keys()]
  const lastSoldAtByListing = new Map<string, string>()

  const recordSale = (listingId: string | null | undefined, soldAt: string | null | undefined) => {
    if (!listingId || !listingById.has(listingId)) return
    const at = parseSoldAt(soldAt)
    if (!at) return
    const existing = lastSoldAtByListing.get(listingId)
    if (!existing || at > existing) lastSoldAtByListing.set(listingId, at)
  }

  // Confirmed checkouts with line items for this seller's listings.
  const { data: orderItems, error: orderItemsError } = await client
    .from("order_items")
    .select("listing_id, quantity, item_price, orders!inner(created_at, status, is_admin_test)")
    .in("listing_id", listingIds)
    .eq("orders.status", "confirmed")
    .eq("orders.is_admin_test", false)

  if (orderItemsError) {
    console.error(
      "[seller-profile-sold-listings] order fallback order_items:",
      orderItemsError.message,
    )
  } else {
    for (const row of orderItems ?? []) {
      const listingId = (row as { listing_id?: string | null }).listing_id
      const order = (row as { orders?: { created_at?: string | null } | { created_at?: string | null }[] })
        .orders
      const createdAt = Array.isArray(order) ? order[0]?.created_at : order?.created_at
      recordSale(listingId, createdAt)
    }
  }

  // Legacy single-listing orders (no order_items).
  const { data: legacyOrders, error: legacyError } = await client
    .from("orders")
    .select("listing_id, created_at")
    .eq("status", "confirmed")
    .eq("is_admin_test", false)
    .in("listing_id", listingIds)
    .not("listing_id", "is", null)

  if (legacyError) {
    console.error(
      "[seller-profile-sold-listings] order fallback legacy orders:",
      legacyError.message,
    )
  } else {
    for (const row of legacyOrders ?? []) {
      recordSale(
        (row as { listing_id?: string | null }).listing_id,
        (row as { created_at?: string | null }).created_at,
      )
    }
  }

  const refs: SellerProfileSoldListingRef[] = []

  for (const [listingId, row] of listingById) {
    const status = String((row as { status?: string | null }).status ?? "")
    const hidden = Boolean((row as { hidden_from_site?: boolean | null }).hidden_from_site)
    const archivedAt = (row as { archived_at?: string | null }).archived_at
    const saleAt = lastSoldAtByListing.get(listingId) ?? null

    const isFullySold = status === "sold"
    const isOpenQuantitySale =
      status === "active" && !hidden && archivedAt == null && saleAt != null

    if (!isFullySold && !isOpenQuantitySale) continue

    refs.push({
      listingId,
      lastSoldAt:
        saleAt ??
        parseSoldAt((row as { updated_at?: unknown }).updated_at) ??
        parseSoldAt((row as { created_at?: unknown }).created_at),
    })
  }

  return refs
    .sort((a, b) => {
      const aAt = a.lastSoldAt ?? ""
      const bAt = b.lastSoldAt ?? ""
      if (aAt !== bAt) return bAt.localeCompare(aAt)
      return b.listingId.localeCompare(a.listingId)
    })
    .slice(0, limit)
}

async function fetchSoldRefsFromRpc(
  supabase: SupabaseClient,
  sellerId: string,
  limit: number,
): Promise<SellerProfileSoldListingRef[] | null> {
  const { data, error } = await supabase.rpc("seller_profile_sold_listing_ids", {
    p_seller_id: sellerId,
    p_sections: PEER_LISTING_SECTIONS_FILTER,
    p_limit: limit,
  })

  if (!error) {
    const refs: SellerProfileSoldListingRef[] = []
    for (const row of data ?? []) {
      const listingId =
        typeof (row as { listing_id?: unknown }).listing_id === "string"
          ? (row as { listing_id: string }).listing_id
          : ""
      if (!listingId) continue
      refs.push({
        listingId,
        lastSoldAt: parseSoldAt((row as { last_sold_at?: unknown }).last_sold_at),
      })
    }
    return refs
  }

  if (!isSellerProfileSoldListingRpcMissing(error)) {
    console.error("[seller-profile-sold-listings] rpc:", error.message)
  }

  return null
}

async function fetchStatusSoldOnlyFallback(
  supabase: SupabaseClient,
  sellerId: string,
  limit: number,
): Promise<SellerProfileSoldListingRef[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, updated_at, created_at")
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .eq("status", "sold")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[seller-profile-sold-listings] status=sold fallback:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    listingId: String((row as { id: string }).id),
    lastSoldAt:
      parseSoldAt((row as { updated_at?: unknown }).updated_at) ??
      parseSoldAt((row as { created_at?: unknown }).created_at),
  }))
}

/**
 * Seller shop Sold history — indexed listings read via `last_sold_at`.
 * Fully sold rows plus leftover-stock quantity sales.
 *
 * Fallbacks (migration lag): interim RPC → order rebuild → status=sold only.
 */
export async function fetchSellerProfileSoldListingRefs(
  supabase: SupabaseClient,
  sellerId: string,
  limit: number,
): Promise<{ refs: SellerProfileSoldListingRef[]; usedDenorm: boolean }> {
  const capped = Math.min(Math.max(limit, 1), 300)

  const soldQuery = supabase
    .from("listings")
    .select("id, last_sold_at")
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .eq("status", "sold")
    .order("last_sold_at", { ascending: false, nullsFirst: false })
    .limit(capped)

  const quantitySaleQuery = supabase
    .from("listings")
    .select("id, last_sold_at")
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .eq("status", "active")
    .not("last_sold_at", "is", null)
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("last_sold_at", { ascending: false })
    .limit(capped)

  const [soldRes, quantityRes] = await Promise.all([soldQuery, quantitySaleQuery])

  if (
    isListingLastSoldAtColumnMissing(soldRes.error) ||
    isListingLastSoldAtColumnMissing(quantityRes.error)
  ) {
    console.warn(
      "[seller-profile-sold-listings] last_sold_at missing; trying RPC / order fallback",
    )

    const rpcRefs = await fetchSoldRefsFromRpc(supabase, sellerId, capped)
    if (rpcRefs) return { refs: rpcRefs, usedDenorm: false }

    const orderRefs = await fetchSoldRefsFromOrdersFallback(supabase, sellerId, capped)
    if (orderRefs.length > 0) return { refs: orderRefs, usedDenorm: false }

    return {
      usedDenorm: false,
      refs: await fetchStatusSoldOnlyFallback(supabase, sellerId, capped),
    }
  }

  if (soldRes.error) {
    console.error("[seller-profile-sold-listings] sold:", soldRes.error.message)
  }
  if (quantityRes.error) {
    console.error(
      "[seller-profile-sold-listings] quantity sales:",
      quantityRes.error.message,
    )
  }

  const refs = mergeSoldRefs(
    [
      ...((soldRes.data ?? []) as Array<{ id?: unknown; last_sold_at?: unknown }>),
      ...((quantityRes.data ?? []) as Array<{ id?: unknown; last_sold_at?: unknown }>),
    ],
    capped,
  )

  return { refs, usedDenorm: true }
}

/**
 * Latest confirmed sale line per listing — quantity + line total for Sold-tab
 * stamps / price labels (matches `/sold` multi-qty presentation).
 */
export async function fetchSellerProfileSoldSaleMetaByListingId(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<Map<string, SellerProfileSoldSaleMeta>> {
  const result = new Map<string, SellerProfileSoldSaleMeta>()
  if (listingIds.length === 0) return result

  const client = await serviceOrFallback(supabase)
  const uniqueIds = [...new Set(listingIds)]

  const { data: orderItems, error } = await client
    .from("order_items")
    .select(
      "listing_id, quantity, item_price, orders!inner(created_at, status, is_admin_test)",
    )
    .in("listing_id", uniqueIds)
    .eq("orders.status", "confirmed")
    .eq("orders.is_admin_test", false)

  if (error) {
    console.error("[seller-profile-sold-listings] sale meta:", error.message)
    return result
  }

  for (const row of orderItems ?? []) {
    const listingId = (row as { listing_id?: string | null }).listing_id
    if (!listingId) continue
    const order = (
      row as { orders?: { created_at?: string | null } | { created_at?: string | null }[] }
    ).orders
    const soldAt = parseSoldAt(
      Array.isArray(order) ? order[0]?.created_at : order?.created_at,
    )
    const quantitySold = parseQuantity((row as { quantity?: unknown }).quantity)
    const unitPrice = parseMoney((row as { item_price?: unknown }).item_price)
    const soldPrice =
      unitPrice != null
        ? Math.round(unitPrice * quantitySold * 100) / 100
        : null

    const existing = result.get(listingId)
    if (!existing || (soldAt != null && (existing.soldAt == null || soldAt > existing.soldAt))) {
      result.set(listingId, { quantitySold, soldPrice, soldAt })
    }
  }

  return result
}
