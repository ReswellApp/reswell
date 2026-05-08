import type { SupabaseClient } from "@supabase/supabase-js"
import { PDP_PEER_SURFBOARD_STRIP_SELECT } from "@/lib/db/listing-detail-similar-surfboards"

/**
 * Active peer surfboards for the given ids, in the same order as `orderedIds` (omitting missing / inactive).
 */
export async function fetchActiveSurfboardListingsByIdsOrdered(
  supabase: SupabaseClient,
  orderedIds: readonly string[],
): Promise<Record<string, unknown>[]> {
  const unique = [...new Set(orderedIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(PDP_PEER_SURFBOARD_STRIP_SELECT)
    .eq("section", "surfboards")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .in("id", unique)

  if (error || !data?.length) return []

  const byId = new Map<string, Record<string, unknown>>()
  for (const row of data as Record<string, unknown>[]) {
    const id = row.id != null ? String(row.id) : ""
    if (id) byId.set(id, row)
  }

  const out: Record<string, unknown>[] = []
  for (const id of orderedIds) {
    const row = byId.get(id.trim())
    if (row) out.push(row)
  }
  return out
}
