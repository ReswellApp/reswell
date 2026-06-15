import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { pickFeaturedListingsForInactiveUser } from "@/lib/klaviyo/inactivity-featured-listings"
import { trackKlaviyoUserInactiveMilestone } from "@/lib/klaviyo/track-user-inactive-milestone"
import { fetchRecentPublicListingsPoolForKlaviyo } from "@/lib/db/recentPublicListingsForKlaviyo"
import { fetchInactiveUserPreferences } from "@/lib/db/inactiveUserPreferences"
import {
  fetchProfilesEligibleForKlaviyoInactivity,
  inactivityMilestoneTiersUpTo,
  recordKlaviyoInactivityMilestonesSent,
  KLAVIYO_INACTIVITY_MILESTONE_DAYS,
  type KlaviyoInactivityMilestoneDays,
} from "@/lib/db/klaviyoInactivityMilestones"
import type { SupabaseClient } from "@supabase/supabase-js"

const BATCH_SIZE = 8

export type ProcessKlaviyoInactivityMilestonesSummary = {
  milestoneDays: KlaviyoInactivityMilestoneDays
  eligible: number
  /** Klaviyo accepted (2xx) or skipped with key missing — row recorded only on success. */
  emitted: number
  failed: number
  errors: string[]
}

/**
 * For one milestone N: emit **User Inactive N Days** for every profile with
 * `last_active_at < referenceTime - N days` that has not been messaged this
 * inactivity streak. When we emit, we also stamp every lower tier as sent so the
 * recipient does not receive multiple inactive emails in a single run — the
 * highest pending tier wins. Processing tiers high→low (see `processAll…`) makes
 * this the effective "highest pending tier per user per run" behavior.
 */
export async function processKlaviyoInactivityMilestone(
  supabase: SupabaseClient,
  milestoneDays: KlaviyoInactivityMilestoneDays,
  referenceTime: Date,
): Promise<ProcessKlaviyoInactivityMilestonesSummary> {
  const cutoff = new Date(referenceTime.getTime() - milestoneDays * 24 * 60 * 60 * 1000)
  const { data: profiles, error: fetchErr } = await fetchProfilesEligibleForKlaviyoInactivity(
    supabase,
    milestoneDays,
    cutoff,
  )

  if (fetchErr) {
    return {
      milestoneDays,
      eligible: 0,
      emitted: 0,
      failed: 0,
      errors: [fetchErr],
    }
  }

  let listingPool: Awaited<
    ReturnType<typeof fetchRecentPublicListingsPoolForKlaviyo>
  >["data"] = []

  if (profiles.length > 0) {
    const poolRes = await fetchRecentPublicListingsPoolForKlaviyo(supabase)
    listingPool = poolRes.data
    if (poolRes.error) {
      console.error(
        "[klaviyo] inactive milestones: listing pool failed:",
        poolRes.error,
      )
    }
  }

  // Tiers to stamp on a successful send (this tier + every lower one).
  const tiersToRecord = inactivityMilestoneTiersUpTo(milestoneDays)

  const errors: string[] = []
  let emitted = 0
  let failed = 0

  for (let offset = 0; offset < profiles.length; offset += BATCH_SIZE) {
    const slice = profiles.slice(offset, offset + BATCH_SIZE)
    const batchOutcomes = await Promise.all(
      slice.map(async (p) => {
        let email = typeof p.email === "string" && p.email.trim() ? p.email.trim() : null
        if (!email) {
          email = await getAuthEmailForUserId(p.id)
        }

        const preferences = await fetchInactiveUserPreferences(supabase, p.id)

        const result = await trackKlaviyoUserInactiveMilestone({
          userId: p.id,
          email,
          displayName: p.display_name,
          milestoneDays,
          lastActiveAtIso: p.last_active_at,
          featuredListings: pickFeaturedListingsForInactiveUser(
            listingPool,
            p.id,
            undefined,
            preferences,
          ),
        })

        if (result.ok) {
          const ins = await recordKlaviyoInactivityMilestonesSent(supabase, p.id, tiersToRecord)
          if (ins.error) {
            return {
              kind: "failed" as const,
              msg: `${p.id}: recorded milestone failed — ${ins.error}`,
            }
          }
          return { kind: "emitted" as const }
        }

        if (result.skipped) {
          /* Missing API key or profile id — do not record so a later run can emit. */
          return { kind: "skipped" as const }
        }

        return {
          kind: "failed" as const,
          msg: `${p.id}: Klaviyo ${result.status} — ${result.detail.slice(0, 200)}`,
        }
      }),
    )

    for (const o of batchOutcomes) {
      if (o.kind === "emitted") emitted += 1
      if (o.kind === "failed") {
        failed += 1
        if (o.msg) errors.push(o.msg)
      }
    }
  }

  return {
    milestoneDays,
    eligible: profiles.length,
    emitted,
    failed,
    errors: errors.slice(0, 50),
  }
}

export async function processAllKlaviyoInactivityMilestones(
  supabase: SupabaseClient,
  referenceTime: Date,
): Promise<ProcessKlaviyoInactivityMilestonesSummary[]> {
  // Highest tier first so a deep-inactive user is stamped for the lower tiers and
  // therefore drops out of those passes — they get one email (the highest tier),
  // not three. Lower tiers still fire on later runs as a user ages into them.
  const tiersDescending = [...KLAVIYO_INACTIVITY_MILESTONE_DAYS].sort((a, b) => b - a)

  const summaries: ProcessKlaviyoInactivityMilestonesSummary[] = []
  for (const days of tiersDescending) {
    summaries.push(await processKlaviyoInactivityMilestone(supabase, days, referenceTime))
  }
  return summaries
}
