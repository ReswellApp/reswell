import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

export type SellerProfileSoldListingRef = {
  listingId: string
  lastSoldAt: string | null
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

function parseSoldAt(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
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

/**
 * Seller shop Sold history — indexed listings read via `last_sold_at`.
 * Fully sold rows plus in-stock brand-new quantity sales.
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
    .in("condition", ["brand_new", "new"])
    .gt("stock_quantity", 0)
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
      "[seller-profile-sold-listings] last_sold_at missing; falling back to status=sold only",
    )
    const { data, error } = await supabase
      .from("listings")
      .select("id, updated_at, created_at")
      .eq("user_id", sellerId)
      .in("section", PEER_LISTING_SECTIONS_FILTER)
      .eq("status", "sold")
      .order("updated_at", { ascending: false })
      .limit(capped)

    if (error) {
      console.error("[seller-profile-sold-listings] fallback:", error.message)
      return { refs: [], usedDenorm: false }
    }

    return {
      usedDenorm: false,
      refs: (data ?? []).map((row) => ({
        listingId: String((row as { id: string }).id),
        lastSoldAt:
          parseSoldAt((row as { updated_at?: unknown }).updated_at) ??
          parseSoldAt((row as { created_at?: unknown }).created_at),
      })),
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
