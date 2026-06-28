import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"

/** Reverb-style mosaic: 7 tiles (hero + 6 satellites), ~50/50 surfboards and fins. */
export const HOME_MOST_VIEWED_MOSAIC_TILE_COUNT = 7
/** Featured mosaic + horizontal scroll strip. */
export const HOME_MOST_VIEWED_TOTAL_TILE_COUNT = 19
export const HOME_MOST_VIEWED_PER_SECTION_LIMIT = 10

type MostViewedSection = "surfboards" | "fins"

async function fetchMostViewedListingRowsForSection(
  supabase: SupabaseClient,
  section: MostViewedSection,
  limit: number,
): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "active")
    .eq("section", section)
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("views", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`fetchMostViewedListingRowsForSection (${section}):`, error.message)
    return []
  }

  return data ?? []
}

export async function fetchHomeMostViewedSurfboardRows(
  supabase: SupabaseClient,
  limit = HOME_MOST_VIEWED_PER_SECTION_LIMIT,
): Promise<unknown[]> {
  return fetchMostViewedListingRowsForSection(supabase, "surfboards", limit)
}

export async function fetchHomeMostViewedFinRows(
  supabase: SupabaseClient,
  limit = HOME_MOST_VIEWED_PER_SECTION_LIMIT,
): Promise<unknown[]> {
  return fetchMostViewedListingRowsForSection(supabase, "fins", limit)
}
