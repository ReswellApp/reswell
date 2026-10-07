import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Add-to-cart eligibility columns.
 * `inventory_source` is intentionally absent: production may not have that column yet,
 * and selecting it turns every cart add into a Postgres 42703.
 */
export const LISTING_CART_ELIGIBILITY_SELECT =
  "id, user_id, section, status, local_pickup, shipping_available, hidden_from_site, archived_at, stock_quantity"

type InventorySourceError = {
  code?: string | null
  message?: string | null
} | null

type ListingInventoryRef = {
  id: string
  user_id: string | null
}

/**
 * True when PostgREST/Postgres rejected a select because `listings.inventory_source` is not there.
 * A missing column means every listing is a native Reswell listing.
 */
export function isMissingInventorySourceColumn(error: InventorySourceError): boolean {
  if (!error) return false
  const message = error.message ?? ""
  if (error.code === "42703" && message.includes("inventory_source")) return true
  return message.includes("inventory_source") && message.toLowerCase().includes("does not exist")
}

/**
 * Reads `inventory_source` only for sellers who have an active Shopify connection.
 * No connection, a null source, or a missing column all mean a native Reswell listing.
 * This never writes listing rows.
 */
export async function fetchInventorySourceByListingId(
  supabase: SupabaseClient,
  listings: ListingInventoryRef[],
): Promise<Map<string, string | null>> {
  const sellerIds = [
    ...new Set(
      listings
        .map((listing) => listing.user_id)
        .filter((userId): userId is string => typeof userId === "string" && userId.length > 0),
    ),
  ]
  if (sellerIds.length === 0) return new Map()

  const { data: connections, error: connectionError } = await supabase
    .from("shopify_connections")
    .select("user_id")
    .in("user_id", sellerIds)
    .eq("status", "active")

  if (connectionError || !connections?.length) {
    if (connectionError) {
      console.error("[inventory-source] connection lookup skipped", {
        code: connectionError.code,
        message: connectionError.message,
      })
    }
    return new Map()
  }

  const connectedSellerIds = new Set(
    connections.map((row) => String((row as { user_id?: string }).user_id ?? "")).filter(Boolean),
  )
  const listingIds = listings
    .filter((listing) => listing.user_id != null && connectedSellerIds.has(listing.user_id))
    .map((listing) => listing.id)
  if (listingIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("listings")
    .select("id, inventory_source")
    .in("id", listingIds)

  if (error) {
    if (!isMissingInventorySourceColumn(error)) {
      console.error("[inventory-source] optional read failed", {
        code: error.code,
        message: error.message,
      })
    }
    return new Map()
  }

  const sources = new Map<string, string | null>()
  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? "")
    if (!id) continue
    const source = (row as { inventory_source?: string | null }).inventory_source
    sources.set(id, source ?? null)
  }
  return sources
}

export async function withShopifyInventorySources<T extends ListingInventoryRef>(
  supabase: SupabaseClient,
  listings: T[],
): Promise<Array<T & { inventory_source: string | null }>> {
  const sources = await fetchInventorySourceByListingId(supabase, listings)
  return listings.map((listing) => ({
    ...listing,
    inventory_source: sources.get(listing.id) ?? null,
  }))
}

export const WALLET_INVENTORY_SOURCE_UNVERIFIED =
  "Could not verify this listing for wallet checkout. Try again."

export type WalletListingInventorySource =
  | { ok: true; kind: "native" }
  | { ok: true; kind: "shopify" }
  | { ok: false; error: string }

/**
 * Wallet checkout must not infer a native listing from Shopify connection state.
 * Native only when the column is confirmed missing, or the stored value was read and is not `shopify`.
 * Any other read failure rejects the purchase. This never writes listing rows.
 */
export async function resolveWalletListingInventorySource(
  supabase: SupabaseClient,
  listingId: string,
): Promise<WalletListingInventorySource> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, inventory_source")
    .eq("id", listingId)
    .maybeSingle()

  if (error) {
    if (isMissingInventorySourceColumn(error)) {
      return { ok: true, kind: "native" }
    }
    console.error("[wallet] inventory source read failed", {
      code: error.code,
      message: error.message,
    })
    return { ok: false, error: WALLET_INVENTORY_SOURCE_UNVERIFIED }
  }

  const row = data as { id?: string; inventory_source?: string | null } | null
  if (!row || !("inventory_source" in row) || String(row.id ?? "") !== listingId) {
    return { ok: false, error: WALLET_INVENTORY_SOURCE_UNVERIFIED }
  }

  if (row.inventory_source === "shopify") {
    return { ok: true, kind: "shopify" }
  }
  return { ok: true, kind: "native" }
}

/**
 * Cart and card checkout use the buyer session, which cannot read `shopify_connections`.
 * Prefer the service role for this read so a connected shop is recognized once the
 * column exists. If that client is unavailable, the buyer client is used and a
 * failed lookup stays a native listing. Wallet checkout does not use this helper.
 */
export async function withShopifyInventorySourcesForPurchase<T extends ListingInventoryRef>(
  fallback: SupabaseClient,
  listings: T[],
): Promise<Array<T & { inventory_source: string | null }>> {
  let client = fallback
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role")
    client = createServiceRoleClient()
  } catch (error) {
    console.error("[inventory-source] service role unavailable", error)
  }
  return withShopifyInventorySources(client, listings)
}
