import type { SupabaseClient } from "@supabase/supabase-js"

import {
  fetchEligibleGiveawayListingReminders,
  GIVEAWAY_LISTING_REMINDER_CRON_BATCH,
  GIVEAWAY_LISTING_REMINDER_STALE_HOURS,
  giveawayListingReminderCutoff,
  recordGiveawayListingNudgeSent,
} from "@/lib/db/giveawayListingNudges"
import { findPublishedSurfboardId } from "@/lib/db/giveawayEntries"
import { listCurrentGiveaways, isGiveawayOpen } from "@/lib/giveaways/catalog"
import { trackKlaviyoGiveawayListingReminder } from "@/lib/klaviyo/track-giveaway-entry"
import { qualifyPublishedListingForGiveaways } from "@/lib/services/giveawayEntry"

export type ProcessGiveawayListingRemindersSummary = {
  eligible: number
  emitted: number
  qualifiedInstead: number
  skippedNoEmail: number
  failed: number
  errors: string[]
}

export async function processGiveawayListingReminders(
  supabase: SupabaseClient,
  options: {
    referenceTime?: Date
    limit?: number
    minAgeHours?: number
  } = {},
): Promise<ProcessGiveawayListingRemindersSummary> {
  const summary: ProcessGiveawayListingRemindersSummary = {
    eligible: 0,
    emitted: 0,
    qualifiedInstead: 0,
    skippedNoEmail: 0,
    failed: 0,
    errors: [],
  }

  const referenceTime = options.referenceTime ?? new Date()
  const minAgeHours = options.minAgeHours ?? GIVEAWAY_LISTING_REMINDER_STALE_HOURS
  const openSlugs = listCurrentGiveaways(referenceTime.getTime())
    .filter((giveaway) => giveaway.requiresSurfboardListing && isGiveawayOpen(giveaway, referenceTime.getTime()))
    .map((giveaway) => giveaway.slug)

  const { data, error } = await fetchEligibleGiveawayListingReminders(supabase, {
    giveawaySlugs: openSlugs,
    staleBefore: giveawayListingReminderCutoff(referenceTime, minAgeHours),
    limit: options.limit ?? GIVEAWAY_LISTING_REMINDER_CRON_BATCH,
  })
  if (error) {
    summary.errors.push(error)
    return summary
  }

  summary.eligible = data.length

  for (const entry of data) {
    try {
      const publishedId = await findPublishedSurfboardId(supabase, entry.user_id)
      if (publishedId) {
        await qualifyPublishedListingForGiveaways(
          supabase,
          publishedId,
          entry.user_id,
          entry.email,
        )
        summary.qualifiedInstead += 1
        continue
      }

      const result = await trackKlaviyoGiveawayListingReminder({
        userId: entry.user_id,
        userEmail: entry.email,
        giveawaySlug: entry.giveaway_slug,
        entryId: entry.id,
        preferredBrand: entry.preferred_brand,
        enteredAt: entry.created_at,
      })
      if (result.skipped && result.skipReason?.includes("No profile identifier")) {
        summary.skippedNoEmail += 1
        continue
      }
      if (!result.ok) {
        summary.failed += 1
        summary.errors.push(`${entry.id}: ${result.detail || result.skipReason || "send failed"}`)
        continue
      }

      const recorded = await recordGiveawayListingNudgeSent(supabase, entry.id, entry.user_id)
      if (recorded.error) {
        summary.failed += 1
        summary.errors.push(`${entry.id}: logged event but failed to record nudge (${recorded.error})`)
        continue
      }
      summary.emitted += 1
    } catch (e) {
      summary.failed += 1
      const msg = e instanceof Error ? e.message : String(e)
      summary.errors.push(`${entry.id}: ${msg}`)
    }
  }

  return summary
}
