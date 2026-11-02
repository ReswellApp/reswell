import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

export type SellerProfileSoldListingRef = {
  listingId: string
  lastSoldAt: string | null
}

/** PostgREST: RPC not in schema cache yet (migration pending). */
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

/**
 * Seller shop Sold history ids — fully sold listings plus in-stock brand-new
 * quantity sales (same eligibility as the marketplace `/sold` feed).
 */
export async function fetchSellerProfileSoldListingRefs(
  supabase: SupabaseClient,
  sellerId: string,
  limit: number,
): Promise<{ refs: SellerProfileSoldListingRef[]; usedRpc: boolean }> {
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
      const lastSoldAtRaw = (row as { last_sold_at?: unknown }).last_sold_at
      refs.push({
        listingId,
        lastSoldAt: typeof lastSoldAtRaw === "string" ? lastSoldAtRaw : null,
      })
    }
    return { refs, usedRpc: true }
  }

  if (!isSellerProfileSoldListingRpcMissing(error)) {
    console.error("[seller-profile-sold-listings] rpc:", error.message)
  } else {
    console.warn(
      "[seller-profile-sold-listings] RPC missing; falling back to status=sold listings only",
    )
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("listings")
    .select("id, updated_at, created_at")
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .eq("status", "sold")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (fallbackError) {
    console.error("[seller-profile-sold-listings] fallback:", fallbackError.message)
    return { refs: [], usedRpc: false }
  }

  const refs: SellerProfileSoldListingRef[] = (fallbackRows ?? []).map((row) => ({
    listingId: String((row as { id: string }).id),
    lastSoldAt:
      typeof (row as { updated_at?: string | null }).updated_at === "string"
        ? (row as { updated_at: string }).updated_at
        : typeof (row as { created_at?: string | null }).created_at === "string"
          ? (row as { created_at: string }).created_at
          : null,
  }))

  return { refs, usedRpc: false }
}
