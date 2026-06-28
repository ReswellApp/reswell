import type { SupabaseClient } from "@supabase/supabase-js"
import type { HomePeerScrollListing } from "@/components/features/home/home-peer-listing-scroll-tile"
import {
  fetchHomeMostViewedFinRows,
  fetchHomeMostViewedSurfboardRows,
  HOME_MOST_VIEWED_MOSAIC_TILE_COUNT,
  HOME_MOST_VIEWED_PER_SECTION_LIMIT,
  HOME_MOST_VIEWED_TOTAL_TILE_COUNT,
} from "@/lib/db/home-most-viewed-listings"

export type HomeMostViewedMosaicLayout = {
  hero: HomePeerScrollListing
  /** Six surrounding tiles: top L→R, middle L/R, bottom-left (hero sits center). */
  satellites: HomePeerScrollListing[]
  /** Additional listings in the compact scroll row below the mosaic. */
  scrollListings: HomePeerScrollListing[]
}

function listingViewCount(listing: HomePeerScrollListing): number {
  const views = (listing as HomePeerScrollListing & { views?: number | null }).views
  const parsed = Number(views ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Alternates surfboards and fins so the strip reads ~50/50 (board, fin, board, fin, …). */
export function interleaveHomeMostViewedListings(
  surfboards: HomePeerScrollListing[],
  fins: HomePeerScrollListing[],
): HomePeerScrollListing[] {
  const merged: HomePeerScrollListing[] = []
  const maxLen = Math.max(surfboards.length, fins.length)

  for (let i = 0; i < maxLen; i++) {
    const board = surfboards[i]
    const fin = fins[i]
    if (board) merged.push(board)
    if (fin) merged.push(fin)
  }

  return merged
}

/** Highest-view listing is the center hero; the rest fill the surrounding slots. */
export function arrangeHomeMostViewedMosaic(
  listings: HomePeerScrollListing[],
): HomeMostViewedMosaicLayout | null {
  if (listings.length === 0) return null

  const sorted = [...listings].sort((a, b) => listingViewCount(b) - listingViewCount(a))
  const hero = sorted[0]
  if (!hero) return null

  const satellites = sorted.slice(1, HOME_MOST_VIEWED_MOSAIC_TILE_COUNT)
  const scrollListings = sorted.slice(
    HOME_MOST_VIEWED_MOSAIC_TILE_COUNT,
    HOME_MOST_VIEWED_TOTAL_TILE_COUNT,
  )

  return { hero, satellites, scrollListings }
}

export async function loadHomeMostViewedMixedRows(
  supabase: SupabaseClient,
  perSectionLimit = HOME_MOST_VIEWED_PER_SECTION_LIMIT,
): Promise<HomePeerScrollListing[]> {
  const [surfboardRows, finRows] = await Promise.all([
    fetchHomeMostViewedSurfboardRows(supabase, perSectionLimit),
    fetchHomeMostViewedFinRows(supabase, perSectionLimit),
  ])

  const merged = interleaveHomeMostViewedListings(
    surfboardRows as HomePeerScrollListing[],
    finRows as HomePeerScrollListing[],
  )

  return merged.slice(0, HOME_MOST_VIEWED_TOTAL_TILE_COUNT)
}

export async function loadHomeMostViewedMosaic(
  supabase: SupabaseClient,
): Promise<HomeMostViewedMosaicLayout | null> {
  const mixedRows = await loadHomeMostViewedMixedRows(supabase)
  return arrangeHomeMostViewedMosaic(mixedRows)
}
