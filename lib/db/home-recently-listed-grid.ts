import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"

/** Recently listed homepage grid — 16 tiles on mobile (2×8), 15 on desktop (5×3). */
export const HOME_RECENTLY_LISTED_GRID_TILE_COUNT = 16
export const HOME_RECENTLY_LISTED_GRID_DESKTOP_TILE_COUNT = 15
/** Fetch buffer per pool (most viewed + newest, each section). */
export const HOME_RECENTLY_LISTED_GRID_PER_SECTION_FETCH = 12

type RecentGridSection = "surfboards" | "fins"

async function fetchRecentlyListedRowsForSection(
  supabase: SupabaseClient,
  section: RecentGridSection,
  limit: number,
): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "active")
    .eq("section", section)
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`fetchRecentlyListedRowsForSection (${section}):`, error.message)
    return []
  }

  return data ?? []
}

export async function fetchHomeRecentlyListedSurfboardRows(
  supabase: SupabaseClient,
  limit = HOME_RECENTLY_LISTED_GRID_PER_SECTION_FETCH,
): Promise<unknown[]> {
  return fetchRecentlyListedRowsForSection(supabase, "surfboards", limit)
}

export async function fetchHomeRecentlyListedFinRows(
  supabase: SupabaseClient,
  limit = HOME_RECENTLY_LISTED_GRID_PER_SECTION_FETCH,
): Promise<unknown[]> {
  return fetchRecentlyListedRowsForSection(supabase, "fins", limit)
}
