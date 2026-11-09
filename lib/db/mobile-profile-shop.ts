import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { fetchSellerProfileSoldListingRefs } from "@/lib/db/seller-profile-sold-listings"
import { getDb } from "@/lib/supabase/db"

export type MobileProfileShopSectionCount = {
  section: string
  count: number
}

/**
 * Peer inventory sections on a seller storefront, for shop category filters.
 * Uses the same visibility rules as public profile listings.
 */
export async function fetchMobileProfileShopSectionCounts(
  sellerId: string,
  status: "current" | "sold",
): Promise<
  { ok: true; rows: MobileProfileShopSectionCount[] } | { ok: false; message: string }
> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })

  if (status === "sold") {
    const { refs } = await fetchSellerProfileSoldListingRefs(supabase, sellerId, 300)
    if (refs.length === 0) return { ok: true, rows: [] }

    const { data, error } = await supabase
      .from("listings")
      .select("section")
      .in(
        "id",
        refs.map((ref) => ref.listingId),
      )
      .eq("user_id", sellerId)
      .in("section", PEER_LISTING_SECTIONS_FILTER)
      .not("title", "ilike", "admin seed%")

    if (error) return { ok: false, message: error.message }

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      const section = typeof row.section === "string" ? row.section.trim() : ""
      if (!section) continue
      counts.set(section, (counts.get(section) ?? 0) + 1)
    }
    return {
      ok: true,
      rows: [...counts.entries()].map(([section, count]) => ({ section, count })),
    }
  }

  const { data, error } = await supabase
    .from("listings")
    .select("section")
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .not("title", "ilike", "admin seed%")

  if (error) return { ok: false, message: error.message }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const section = typeof row.section === "string" ? row.section.trim() : ""
    if (!section) continue
    counts.set(section, (counts.get(section) ?? 0) + 1)
  }

  const rows = [...counts.entries()].map(([section, count]) => ({ section, count }))
  return { ok: true, rows }
}
