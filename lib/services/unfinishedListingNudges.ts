import type { SupabaseClient } from "@supabase/supabase-js"

import {
  fetchEligibleUnfinishedListingDrafts,
  recordUnfinishedListingNudgeSent,
  UNFINISHED_LISTING_CRON_BATCH,
} from "@/lib/db/unfinishedListingNudges"
import { trackKlaviyoUnfinishedListing } from "@/lib/klaviyo/track-unfinished-listing"

export type ProcessUnfinishedListingNudgesSummary = {
  eligible: number
  emitted: number
  skippedNoEmail: number
  failed: number
  errors: string[]
}

export async function processUnfinishedListingNudges(
  supabase: SupabaseClient,
  referenceTime = new Date(),
  limit = UNFINISHED_LISTING_CRON_BATCH,
): Promise<ProcessUnfinishedListingNudgesSummary> {
  const summary: ProcessUnfinishedListingNudgesSummary = {
    eligible: 0,
    emitted: 0,
    skippedNoEmail: 0,
    failed: 0,
    errors: [],
  }

  const { data, error } = await fetchEligibleUnfinishedListingDrafts(
    supabase,
    referenceTime,
    limit,
  )
  if (error) {
    summary.errors.push(error)
    return summary
  }

  summary.eligible = data.length

  for (const listing of data) {
    try {
      const result = await trackKlaviyoUnfinishedListing({ listing })
      if (result.skipped && result.skipReason?.includes("No profile identifier")) {
        summary.skippedNoEmail += 1
        continue
      }
      if (!result.ok) {
        summary.failed += 1
        summary.errors.push(`${listing.id}: ${result.detail || result.skipReason || "send failed"}`)
        continue
      }

      const recorded = await recordUnfinishedListingNudgeSent(
        supabase,
        listing.id,
        listing.user_id,
      )
      if (recorded.error) {
        summary.failed += 1
        summary.errors.push(`${listing.id}: logged event but failed to record nudge (${recorded.error})`)
        continue
      }
      summary.emitted += 1
    } catch (e) {
      summary.failed += 1
      const msg = e instanceof Error ? e.message : String(e)
      summary.errors.push(`${listing.id}: ${msg}`)
    }
  }

  return summary
}
