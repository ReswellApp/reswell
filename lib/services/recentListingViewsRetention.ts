import type { SupabaseClient } from "@supabase/supabase-js"

import { trimRecentListingViewsBatch } from "@/lib/db/recentListingViewsRetention"

export const RECENT_LISTING_VIEWS_KEEP_ROWS = 100
export const RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE = 500
export const RECENT_LISTING_VIEWS_MAX_BATCHES = 10

export interface RecentListingViewsRetentionSummary {
  deleted: number
  batches: number
  keepRows: number
  batchSize: number
  limitReached: boolean
}

type TrimBatch = (
  supabase: SupabaseClient,
  options: { keepRows: number; deleteLimit: number },
) => Promise<number>

export async function trimRecentListingViewsRetention(
  supabase: SupabaseClient,
  trimBatch: TrimBatch = trimRecentListingViewsBatch,
): Promise<RecentListingViewsRetentionSummary> {
  let deleted = 0
  let batches = 0
  let lastBatchDeleted = 0

  while (batches < RECENT_LISTING_VIEWS_MAX_BATCHES) {
    lastBatchDeleted = await trimBatch(supabase, {
      keepRows: RECENT_LISTING_VIEWS_KEEP_ROWS,
      deleteLimit: RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
    })
    deleted += lastBatchDeleted
    batches += 1

    if (lastBatchDeleted < RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE) {
      break
    }
  }

  return {
    deleted,
    batches,
    keepRows: RECENT_LISTING_VIEWS_KEEP_ROWS,
    batchSize: RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
    limitReached:
      batches === RECENT_LISTING_VIEWS_MAX_BATCHES &&
      lastBatchDeleted === RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
  }
}
