import type { SupabaseClient } from "@supabase/supabase-js"
import { isListingLastSoldAtColumnMissing } from "@/lib/db/seller-profile-sold-listings"
import { listingSoldViaCheckoutUpdate } from "@/lib/listing-sold-state"
import { peerBrandNewStockQuantity } from "@/lib/listing-stock-quantity"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isShopifyManagedListing } from "@/lib/shopify/listing"

type ListingSoldUpdate = ReturnType<typeof listingSoldViaCheckoutUpdate>

function listingSoldViaCheckoutUpdateWithoutLastSoldAt(
  at = new Date().toISOString(),
): Omit<ListingSoldUpdate, "last_sold_at"> {
  const { last_sold_at: _omit, ...rest } = listingSoldViaCheckoutUpdate(at)
  return rest
}

/**
 * Mark unique peer listings sold after checkout.
 *
 * `#871` stamps `listings.last_sold_at` for the seller Sold feed. If that column
 * is not migrated yet, PostgREST rejects the whole update (PGRST204) and the
 * listing stays `active` — buyers can pay again for the same item. Fall back to
 * the pre-denorm payload so inventory still locks.
 */
export async function dbMarkListingsSoldViaCheckout(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { ok: true }

  const payload = listingSoldViaCheckoutUpdate()
  const { error } = await supabase.from("listings").update(payload).in("id", ids)
  if (!error) return { ok: true }

  if (!isListingLastSoldAtColumnMissing(error)) {
    return { ok: false, error: error.message }
  }

  console.warn(
    "[listing-sold] listings.last_sold_at missing; marking sold without denorm column. Apply migration 20271204120000_listings_last_sold_at_seller_sold_feed.sql",
  )

  const { error: fallbackError } = await supabase
    .from("listings")
    .update(listingSoldViaCheckoutUpdateWithoutLastSoldAt(payload.updated_at))
    .in("id", ids)

  if (fallbackError) {
    return { ok: false, error: fallbackError.message }
  }

  return { ok: true }
}

/**
 * Repair unique-item sold state when order insert succeeded but mark-sold failed
 * (webhook/finalize alreadyProcessed path). No-ops when already sold.
 */
export async function dbRepairPeerListingsSoldViaCheckout(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<void> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return

  const { data: rows, error } = await supabase
    .from("listings")
    .select("id, section, condition, stock_quantity, inventory_source, status")
    .in("id", ids)

  if (error || !rows?.length) {
    if (error) {
      console.error("[listing-sold] repair lookup failed:", error.message)
    }
    return
  }

  const peerUniqueIds = rows
    .filter((row) => {
      const listing = row as {
        id: string
        section?: string | null
        condition?: string | null
        stock_quantity?: number | null
        inventory_source?: string | null
        status?: string | null
      }
      if (listing.status === "sold") return false
      if (!isPeerListingSection(listing.section)) return false
      if (isShopifyManagedListing(listing)) return false
      return peerBrandNewStockQuantity(listing) < 1
    })
    .map((row) => String((row as { id: string }).id))

  if (peerUniqueIds.length === 0) return

  const marked = await dbMarkListingsSoldViaCheckout(supabase, peerUniqueIds)
  if (!marked.ok) {
    console.error("[listing-sold] repair mark-sold failed:", marked.error, {
      listingIds: peerUniqueIds,
    })
  }
}
