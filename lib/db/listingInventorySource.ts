import type { SupabaseClient } from "@supabase/supabase-js"

type InventorySourceError = { code?: string; message?: string } | null | undefined

let loggedMissingInventorySourceColumn = false

/**
 * True when Postgres or PostgREST cannot read `listings.inventory_source`
 * because migration `20271015120000_shopify_inventory_mvp.sql` is not applied yet.
 */
export function isMissingInventorySourceColumn(error: InventorySourceError): boolean {
  const message = error?.message ?? ""
  if (!message.includes("inventory_source")) return false
  return (
    error?.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  )
}

export type ListingInventorySourceResult =
  | { ok: true; sources: Map<string, string | null> }
  | { ok: false; error: string }

/**
 * Reads `listings.inventory_source` for purchase checks.
 * A missing column returns an empty map: no Shopify-managed row can exist yet,
 * and cart/checkout must keep working until the migration is applied.
 */
export async function loadListingInventorySources(
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<ListingInventorySourceResult> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { ok: true, sources: new Map() }

  const { data, error } = await supabase
    .from("listings")
    .select("id, inventory_source")
    .in("id", ids)

  if (error) {
    if (isMissingInventorySourceColumn(error)) {
      if (!loggedMissingInventorySourceColumn) {
        loggedMissingInventorySourceColumn = true
        console.error(
          "[listings] inventory_source is missing. Apply supabase/migrations/20271015120000_shopify_inventory_mvp.sql",
        )
      }
      return { ok: true, sources: new Map() }
    }
    console.error("[listings] inventory_source lookup:", error.message)
    return { ok: false, error: "Could not verify listing inventory" }
  }

  const sources = new Map<string, string | null>()
  for (const row of data ?? []) {
    const record = row as { id?: unknown; inventory_source?: unknown }
    const id = typeof record.id === "string" ? record.id : ""
    if (!id) continue
    sources.set(id, typeof record.inventory_source === "string" ? record.inventory_source : null)
  }
  return { ok: true, sources }
}

export async function attachListingInventorySources<T extends { id: string }>(
  supabase: SupabaseClient,
  listings: readonly T[],
): Promise<
  | { ok: true; listings: Array<T & { inventory_source: string | null }> }
  | { ok: false; error: string }
> {
  const loaded = await loadListingInventorySources(
    supabase,
    listings.map((listing) => listing.id),
  )
  if (!loaded.ok) return loaded
  return {
    ok: true,
    listings: listings.map((listing) => ({
      ...listing,
      inventory_source: loaded.sources.get(listing.id) ?? null,
    })),
  }
}
