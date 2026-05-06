import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { pickFeaturedListingsForInactiveUser } from "@/lib/klaviyo/inactivity-featured-listings"
import {
  fetchRecentPublicListingsPoolForKlaviyo,
  type RecentPublicListingRowForKlaviyo,
} from "@/lib/db/recentPublicListingsForKlaviyo"
import {
  fetchSentInactiveMilestoneDaysForUser,
  insertKlaviyoInactivityMilestoneSent,
  KLAVIYO_INACTIVITY_MILESTONE_DAYS,
  type KlaviyoInactivityMilestoneDays,
} from "@/lib/db/klaviyoInactivityMilestones"
import { trackKlaviyoUserInactiveMilestone } from "@/lib/klaviyo/track-user-inactive-milestone"
import type { SupabaseClient } from "@supabase/supabase-js"

export type KlaviyoInactiveBackfillStrategy = "highest_pending" | "all_pending"

function isInactiveAtLeastDays(
  lastActiveAtIso: string,
  milestoneDays: KlaviyoInactivityMilestoneDays,
  referenceTime: Date,
): boolean {
  const cutoff = new Date(referenceTime.getTime() - milestoneDays * 24 * 60 * 60 * 1000)
  const t = new Date(lastActiveAtIso).getTime()
  return Number.isFinite(t) && t < cutoff.getTime()
}

function pickMilestonesToSend(
  lastActiveAtIso: string,
  referenceTime: Date,
  alreadySent: Set<KlaviyoInactivityMilestoneDays>,
  strategy: KlaviyoInactiveBackfillStrategy,
  force: boolean,
): KlaviyoInactivityMilestoneDays[] {
  const eligible = KLAVIYO_INACTIVITY_MILESTONE_DAYS.filter(
    (d) =>
      isInactiveAtLeastDays(lastActiveAtIso, d, referenceTime) &&
      (force || !alreadySent.has(d)),
  )

  if (eligible.length === 0) return []

  if (strategy === "highest_pending") {
    return [eligible[eligible.length - 1]!]
  }

  return [...eligible]
}

export type PushKlaviyoInactiveForUserResult = {
  user_id: string
  last_active_at: string | null
  strategy: KlaviyoInactiveBackfillStrategy
  milestones_attempted: KlaviyoInactivityMilestoneDays[]
  sent: Array<{
    milestone_days: KlaviyoInactivityMilestoneDays
    klaviyo_ok: boolean
    klaviyo_skipped: boolean
    klaviyo_status: number
    klaviyo_detail: string
    milestone_recorded: boolean
    record_error: string | null
  }>
  skipped_reason?: string
}

/**
 * Admin backfill: uses `profiles.last_active_at` (same signal as the users table) to decide
 * which **User Inactive N Days** metrics to send. Default strategy sends only the **highest**
 * qualifying tier not yet recorded, to avoid three emails at once.
 */
export async function pushKlaviyoInactiveMilestonesForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    referenceTime?: Date
    strategy?: KlaviyoInactiveBackfillStrategy
    force?: boolean
  },
): Promise<PushKlaviyoInactiveForUserResult> {
  const referenceTime = options?.referenceTime ?? new Date()
  const strategy = options?.strategy ?? "highest_pending"
  const force = options?.force === true

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, display_name, last_active_at")
    .eq("id", userId)
    .maybeSingle()

  if (pErr) {
    return {
      user_id: userId,
      last_active_at: null,
      strategy,
      milestones_attempted: [],
      sent: [],
      skipped_reason: pErr.message,
    }
  }

  if (!profile) {
    return {
      user_id: userId,
      last_active_at: null,
      strategy,
      milestones_attempted: [],
      sent: [],
      skipped_reason: "profile_not_found",
    }
  }

  const lastIso =
    typeof profile.last_active_at === "string" && profile.last_active_at.trim()
      ? profile.last_active_at.trim()
      : null

  if (!lastIso) {
    return {
      user_id: userId,
      last_active_at: null,
      strategy,
      milestones_attempted: [],
      sent: [],
      skipped_reason: "no_last_active_at",
    }
  }

  const { days: sentFromDb, error: sentErr } = await fetchSentInactiveMilestoneDaysForUser(
    supabase,
    userId,
  )

  if (sentErr) {
    return {
      user_id: userId,
      last_active_at: lastIso,
      strategy,
      milestones_attempted: [],
      sent: [],
      skipped_reason: `klaviyo_inactivity_milestones: ${sentErr}`,
    }
  }

  const milestones = pickMilestonesToSend(lastIso, referenceTime, sentFromDb, strategy, force)

  if (milestones.length === 0) {
    return {
      user_id: userId,
      last_active_at: lastIso,
      strategy,
      milestones_attempted: [],
      sent: [],
      skipped_reason: "no_eligible_milestone_or_all_recorded",
    }
  }

  const poolRes = await fetchRecentPublicListingsPoolForKlaviyo(supabase)
  if (poolRes.error) {
    console.error("[klaviyo] admin backfill listing pool:", poolRes.error)
  }
  const listingPool: RecentPublicListingRowForKlaviyo[] = poolRes.data

  let email = typeof profile.email === "string" && profile.email.trim() ? profile.email.trim() : null
  if (!email) {
    email = await getAuthEmailForUserId(userId)
  }

  const sent: PushKlaviyoInactiveForUserResult["sent"] = []
  for (const milestoneDays of milestones) {
    const uniqueIdSuffix = force ? `admin-${batchNonce}-${milestoneDays}d` : undefined

    const result = await trackKlaviyoUserInactiveMilestone({
      userId,
      email,
      displayName: profile.display_name,
      milestoneDays,
      lastActiveAtIso: lastIso,
      featuredListings: pickFeaturedListingsForInactiveUser(listingPool, userId),
      uniqueIdSuffix,
    })

    let milestone_recorded = false
    let record_error: string | null = null

    if (result.ok) {
      const shouldRecord = !sentFromDb.has(milestoneDays)
      if (shouldRecord) {
        const ins = await insertKlaviyoInactivityMilestoneSent(supabase, userId, milestoneDays)
        milestone_recorded = !ins.error
        record_error = ins.error ?? null
      } else {
        milestone_recorded = true
      }
    }

    sent.push({
      milestone_days: milestoneDays,
      klaviyo_ok: result.ok,
      klaviyo_skipped: result.skipped,
      klaviyo_status: result.status,
      klaviyo_detail: result.detail,
      milestone_recorded,
      record_error,
    })
  }

  return {
    user_id: userId,
    last_active_at: lastIso,
    strategy,
    milestones_attempted: milestones,
    sent,
  }
}
