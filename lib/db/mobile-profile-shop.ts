import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
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
  let request = supabase
    .from("listings")
    .select("section")
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)

  if (status === "sold") {
    request = request.eq("status", "sold")
  } else {
    request = request
      .in("status", ["active", "pending_sale"])
      .eq("hidden_from_site", false)
      .is("archived_at", null)
  }

  const { data, error } = await request.not("title", "ilike", "admin seed%")
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
