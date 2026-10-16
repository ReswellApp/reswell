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
  surfboardAlertIndexSnapshot,
  type SurfboardAlertIndexSnapshot,
} from "@/lib/services/boardSavedSearchMatch"
import { notifyBoardSavedSearchMatchesForListing } from "@/lib/services/notifyBoardSavedSearchMatches"
import { scheduleSurfboardAlertRetry, listSurfboardAlertRetriesDue } from "@/lib/services/savedSearchAlertRetry"
import { savedSearchAlertLookbackStart } from "@/lib/services/savedSearchAlertRetryWindow"
import { sendBoardSavedSearchAlert } from "@/lib/services/sendBoardSavedSearchAlert"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import type { SavedSearchRow } from "@/lib/db/savedSearches"
import type { SupabaseClient } from "@supabase/supabase-js"

export type BoardFinderNewListingAlertSummary = {
  bootstrapped: boolean
  scannedListings: number
  searches: number
  sent: number
  retriedListings: number
  indexPending: number
  listedThrough: string
}

async function listingsMatchingSavedSearch(
  criteria: BoardSavedSearchCriteria,
  listings: NewlyListedSurfboard[],
  index: SurfboardAlertIndexSnapshot,
): Promise<NewlyListedSurfboard[]> {
  if (listings.length === 0) return []

  const fieldMatch = (rows: NewlyListedSurfboard[]) =>
    rows.filter((row) => listingMatchesBoardSavedCriteria(row.listing, criteria))

  if (index.mode !== "split") return fieldMatch(listings)

  const pending = listings.filter((row) => !index.readyIds.has(row.listing.id))
  const ready = listings.filter((row) => index.readyIds.has(row.listing.id))
  const pendingHits = fieldMatch(pending)
  if (ready.length === 0) return pendingHits

  try {
    const res = await searchBoardsBrowse({
      ...boardSavedCriteriaToBrowseEsParams(criteria),
      restrictToIds: ready.map((row) => row.listing.id),
      from: 0,
      size: ready.length,
      sort: "created-at",
    })
    if (res === null) return [...pendingHits, ...fieldMatch(ready)]
    const hit = new Set(res.ids)
    return [...pendingHits, ...ready.filter((row) => hit.has(row.listing.id))]
  } catch (err) {
    console.error("[board_finder_alerts] elasticsearch match failed, using field fallback:", err)
    return [...pendingHits, ...fieldMatch(ready)]
  }
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

async function runDueIndexRetries(
  service: SupabaseClient,
  now: Date,
): Promise<{ retriedListings: number; sent: number; listingIds: Set<string> }> {
  const due = await listSurfboardAlertRetriesDue(service, now)
  let sent = 0
  const listingIds = new Set<string>()
  for (const retry of due) {
    listingIds.add(retry.listingId)
    try {
      const result = await notifyBoardSavedSearchMatchesForListing(retry.listingId)
      sent += result.sent
    } catch (err) {
      console.error("[board_finder_alerts] index retry failed:", retry.listingId, err)
    }
  }
  return { retriedListings: due.length, sent, listingIds }
}

async function rememberPendingIndex(
  service: SupabaseClient,
  listings: NewlyListedSurfboard[],
  index: SurfboardAlertIndexSnapshot,
  now: Date,
  alreadyRetried: ReadonlySet<string>,
): Promise<number> {
  if (index.mode === "disabled") return 0
  const pending = (
    index.mode === "unchecked"
      ? listings
      : listings.filter((row) => !index.readyIds.has(row.listing.id))
  ).filter((row) => !alreadyRetried.has(row.listing.id))
  for (const row of pending) {
    await scheduleSurfboardAlertRetry(service, row.listing.id, row.listedAt, now)
  }
  return pending.length
}

/**
 * Short catch-up for surfboard saved searches.
 * Replays boards first published since the watermark (at most a few hours back),
 * and retries listings the search index was not ready for. The first run only
 * stores "now" and does not email about boards already listed.
 */
export async function runBoardFinderNewListingAlerts(
  now: Date = new Date(),
): Promise<BoardFinderNewListingAlertSummary> {
  const service = createServiceRoleClient()
  const until = now.toISOString()
  const retries = await runDueIndexRetries(service, now)
  const cursor = await getSavedSearchAlertCursor(service, SURFBOARD_NEW_LISTING_ALERT_JOB)

  if (!cursor) {
    await setSavedSearchAlertCursor(service, SURFBOARD_NEW_LISTING_ALERT_JOB, until)
    return {
      bootstrapped: true,
      scannedListings: 0,
      searches: 0,
      sent: retries.sent,
      retriedListings: retries.retriedListings,
      indexPending: 0,
      listedThrough: until,
    }
  }

  const listedAfter = savedSearchAlertLookbackStart(cursor.listedThrough, now)
  if (listedAfter !== cursor.listedThrough) {
    console.warn("[board_finder_alerts] lookback capped", {
      cursor: cursor.listedThrough,
      listedAfter,
    })
  }

  const window = await listNewlyListedActiveSurfboards(service, listedAfter, until)
  const nextCursor = window.capped && window.lastListedAt ? window.lastListedAt : until

  if (isBoardsBrowseEsEnabled()) {
    for (const row of window.rows) {
      await ensureListingIndexedForSavedSearchAlerts(row.listing.id)
    }
  }

  const index = await surfboardAlertIndexSnapshot(window.rows.map((row) => row.listing.id))
  const indexPending = await rememberPendingIndex(service, window.rows, index, now, retries.listingIds)

  const { data: searches, error: searchErr } = await fetchBoardSavedSearchesWithEmailEnabled(
    service,
    { section: "surfboards" },
  )
  if (searchErr) throw searchErr

  let sent = retries.sent
  for (const search of searches) {
    const candidates = listingsNewForSearch(window.rows, search)
    const matched = await listingsMatchingSavedSearch(search.criteria, candidates, index)
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
    retriedListings: retries.retriedListings,
    indexPending,
    listedThrough: nextCursor,
  }
}
