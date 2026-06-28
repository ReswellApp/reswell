import type { SupabaseClient } from "@supabase/supabase-js"
import type { HomePeerScrollListing } from "@/components/features/home/home-peer-listing-scroll-tile"
import {
  fetchHomeRecentlyListedFinRows,
  fetchHomeRecentlyListedSurfboardRows,
  HOME_RECENTLY_LISTED_GRID_PER_SECTION_FETCH,
  HOME_RECENTLY_LISTED_GRID_TILE_COUNT,
} from "@/lib/db/home-recently-listed-grid"
import {
  fetchHomeMostViewedFinRows,
  fetchHomeMostViewedSurfboardRows,
} from "@/lib/db/home-most-viewed-listings"

function listingViewCount(listing: HomePeerScrollListing): number {
  const views = (listing as HomePeerScrollListing & { views?: number | null }).views
  const parsed = Number(views ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function shuffleListings<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = out[i]
    const swap = out[j]
    if (current === undefined || swap === undefined) continue
    out[i] = swap
    out[j] = current
  }
  return out
}

function takeUniqueListings(
  pool: HomePeerScrollListing[],
  count: number,
  usedIds: Set<string>,
): HomePeerScrollListing[] {
  const picked: HomePeerScrollListing[] = []
  for (const row of pool) {
    if (usedIds.has(row.id)) continue
    usedIds.add(row.id)
    picked.push(row)
    if (picked.length >= count) break
  }
  return picked
}

/**
 * Homepage grid mix: 50% most viewed, 25% newest surfboards, 25% newest fins — then shuffled.
 */
export function composeRecentlyListedGridListings(
  mostViewedSurfboards: HomePeerScrollListing[],
  mostViewedFins: HomePeerScrollListing[],
  newestSurfboards: HomePeerScrollListing[],
  newestFins: HomePeerScrollListing[],
  targetCount = HOME_RECENTLY_LISTED_GRID_TILE_COUNT,
): HomePeerScrollListing[] {
  const viewedCount = Math.round(targetCount * 0.5)
  const newestBoardCount = Math.round(targetCount * 0.25)
  const newestFinCount = targetCount - viewedCount - newestBoardCount

  const viewedPool = [...mostViewedSurfboards, ...mostViewedFins].sort(
    (a, b) => listingViewCount(b) - listingViewCount(a),
  )

  const usedIds = new Set<string>()
  const viewed = takeUniqueListings(viewedPool, viewedCount, usedIds)
  const boards = takeUniqueListings(newestSurfboards, newestBoardCount, usedIds)
  const fins = takeUniqueListings(newestFins, newestFinCount, usedIds)

  const combined: HomePeerScrollListing[] = [...viewed, ...boards, ...fins]

  if (combined.length < targetCount) {
    const fillPool = [...viewedPool, ...newestSurfboards, ...newestFins]
    for (const row of fillPool) {
      if (combined.length >= targetCount) break
      if (usedIds.has(row.id)) continue
      usedIds.add(row.id)
      combined.push(row)
    }
  }

  return shuffleListings(combined).slice(0, targetCount)
}

export async function loadHomeRecentlyListedGridRows(
  supabase: SupabaseClient,
  perSectionLimit = HOME_RECENTLY_LISTED_GRID_PER_SECTION_FETCH,
): Promise<HomePeerScrollListing[]> {
  const [mostViewedSurfboards, mostViewedFins, newestSurfboards, newestFins] = await Promise.all([
    fetchHomeMostViewedSurfboardRows(supabase, perSectionLimit),
    fetchHomeMostViewedFinRows(supabase, perSectionLimit),
    fetchHomeRecentlyListedSurfboardRows(supabase, perSectionLimit),
    fetchHomeRecentlyListedFinRows(supabase, perSectionLimit),
  ])

  const mixed = composeRecentlyListedGridListings(
    mostViewedSurfboards as HomePeerScrollListing[],
    mostViewedFins as HomePeerScrollListing[],
    newestSurfboards as HomePeerScrollListing[],
    newestFins as HomePeerScrollListing[],
  )

  return mixed.length > 0 ? mixed : []
}
