import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

const PAGE_SIZE = 1000

export type TopCityListingLocalityRow = {
  title: string | null
  city: string | null
  state: string | null
  status: string
  hidden_from_site: boolean | null
  archived_at: string | null
}

/**
 * Active, site-visible peer listings — city/state only — for the `/cities/top` directory.
 * Paged to stay under PostgREST’s default row cap.
 */
export async function listActiveListingLocalities(
  supabase: SupabaseClient,
): Promise<TopCityListingLocalityRow[]> {
  const rows: TopCityListingLocalityRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from("listings")
      .select("title, city, state, status, hidden_from_site, archived_at")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .in("section", PEER_LISTING_SECTIONS_FILTER)
      .not("city", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error("[listActiveListingLocalities]", error.message)
      throw new Error("Could not load listing cities")
    }

    const page = (data ?? []) as TopCityListingLocalityRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
