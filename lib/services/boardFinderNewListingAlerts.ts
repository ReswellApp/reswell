import { fetchBoardSavedSearchesWithEmailEnabled } from "@/lib/db/savedSearches"
import {
  listNewlyListedActiveSurfboards,
  type NewlyListedSurfboard,
} from "@/lib/db/newlyListedSurfboards"
import {
  getSavedSearchAlertCursor,
  setSavedSearchAlertCursor,
  SURFBOARD_NEW_LISTING_ALERT_JOB,
} from "@/lib/db/savedSearchAlertCursor"
import { isBoardsBrowseEsEnabled } from "@/lib/db/boards-browse-listings-es"
import { searchBoardsBrowse } from "@/lib/elasticsearch/boards-browse-search"
import { listingListedAfterSavedSearch } from "@/lib/services/boardSavedSearchAlertWindow"
import {
  boardSavedCriteriaToBrowseEsParams,
  ensureListingIndexedForSavedSearchAlerts,
  listingMatchesBoardSavedCriteria,
} from "@/lib/services/boardSavedSearchMatch"
import { sendBoardSavedSearchAlert } from "@/lib/services/sendBoardSavedSearchAlert"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import type { SavedSearchRow } from "@/lib/db/savedSearches"

export type BoardFinderNewListingAlertSummary = {
  bootstrapped: boolean
  scannedListings: number
  searches: number
  sent: number
  listedThrough: string
}

async function listingsMatchingSavedSearch(
  criteria: BoardSavedSearchCriteria,
  listings: NewlyListedSurfboard[],
): Promise<NewlyListedSurfboard[]> {
  if (listings.length === 0) return []

  if (isBoardsBrowseEsEnabled()) {
    try {
      const res = await searchBoardsBrowse({
        ...boardSavedCriteriaToBrowseEsParams(criteria),
        restrictToIds: listings.map((row) => row.listing.id),
        from: 0,
        size: listings.length,
        sort: "created-at",
      })
      if (res !== null) {
        const hit = new Set(res.ids)
        return listings.filter((row) => hit.has(row.listing.id))
      }
    } catch (err) {
      console.error("[board_finder_alerts] elasticsearch match failed, using field fallback:", err)
    }
  }

  return listings.filter((row) => listingMatchesBoardSavedCriteria(row.listing, criteria))
}

function listingsNewForSearch(
  listings: NewlyListedSurfboard[],
  search: SavedSearchRow,
): NewlyListedSurfboard[] {
  return listings.filter(
    (row) =>
      row.listing.user_id !== search.user_id &&
      listingListedAfterSavedSearch(row.listedAt, search.created_at),
  )
}

/**
 * Daily catch-up: replay each surfboard saved search against boards first
 * published since the last run. The first run only stores "now" and sends nothing,
 * so boards already listed are never emailed.
 */
export async function runBoardFinderNewListingAlerts(
  now: Date = new Date(),
): Promise<BoardFinderNewListingAlertSummary> {
  const service = createServiceRoleClient()
  const until = now.toISOString()
  const cursor = await getSavedSearchAlertCursor(service, SURFBOARD_NEW_LISTING_ALERT_JOB)

  if (!cursor) {
    await setSavedSearchAlertCursor(service, SURFBOARD_NEW_LISTING_ALERT_JOB, until)
    return {
      bootstrapped: true,
      scannedListings: 0,
      searches: 0,
      sent: 0,
      listedThrough: until,
    }
  }

  const window = await listNewlyListedActiveSurfboards(service, cursor.listedThrough, until)
  const nextCursor = window.capped && window.lastListedAt ? window.lastListedAt : until

  if (isBoardsBrowseEsEnabled()) {
    for (const row of window.rows) {
      await ensureListingIndexedForSavedSearchAlerts(row.listing.id)
    }
  }

  const { data: searches, error: searchErr } = await fetchBoardSavedSearchesWithEmailEnabled(
    service,
    { section: "surfboards" },
  )
  if (searchErr) throw searchErr

  let sent = 0
  for (const search of searches) {
    const candidates = listingsNewForSearch(window.rows, search)
    const matched = await listingsMatchingSavedSearch(search.criteria, candidates)
    for (const row of matched) {
      const result = await sendBoardSavedSearchAlert(service, search, row.listing, row.photoUrl)
      if (result === "sent") sent += 1
    }
  }

  await setSavedSearchAlertCursor(service, SURFBOARD_NEW_LISTING_ALERT_JOB, nextCursor)

  return {
    bootstrapped: false,
    scannedListings: window.rows.length,
    searches: searches.length,
    sent,
    listedThrough: nextCursor,
  }
}
