import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { pickFeaturedListingsForInactiveUser } from "@/lib/klaviyo/inactivity-featured-listings"
import {
  fetchRecentPublicListingsPoolForKlaviyo,
  type RecentPublicListingRowForKlaviyo,
} from "@/lib/db/recentPublicListingsForKlaviyo"
import {
  fetchInactiveMilestoneDaysSentThisStreak,
  insertKlaviyoInactivityMilestoneSent,
  KLAVIYO_INACTIVITY_MILESTONE_DAYS,
  type KlaviyoInactivityMilestoneDays,
} from "@/lib/db/klaviyoInactivityMilestones"
import { trackKlaviyoUserInactiveMilestone } from "@/lib/klaviyo/track-user-inactive-milestone"
import type { SupabaseClient } from "@supabase/supabase-js"

export type KlaviyoInactiveBackfillStrategy = "highest_pending" | "all_pending"

const MS_PER_DAY = 24 * 60 * 60 * 1000

function isInactiveAtLeastDays(
  lastActiveAtIso: string,
  milestoneDays: KlaviyoInactivityMilestoneDays,
  referenceTime: Date,
): boolean {
  const cutoff = new Date(referenceTime.getTime() - milestoneDays * MS_PER_DAY)
  const t = new Date(lastActiveAtIso).getTime()
  return Number.isFinite(t) && t < cutoff.getTime()
}

function daysSinceLastActive(lastActiveAtIso: string, referenceTime: Date): number {
  const t = new Date(lastActiveAtIso).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((referenceTime.getTime() - t) / MS_PER_DAY))
}

function pickMilestonesToSend(
  lastActiveAtIso: string,
  referenceTime: Date,
  sentThisStreak: Set<KlaviyoInactivityMilestoneDays>,
  strategy: KlaviyoInactiveBackfillStrategy,
  force: boolean,
): KlaviyoInactivityMilestoneDays[] {
  const eligible = KLAVIYO_INACTIVITY_MILESTONE_DAYS.filter(
    (d) =>
      isInactiveAtLeastDays(lastActiveAtIso, d, referenceTime) &&
      (force || !sentThisStreak.has(d)),
  )

  if (eligible.length === 0) return []

  if (strategy === "highest_pending") {
    return [eligible[eligible.length - 1]!]
  }

  return [...eligible]
}

export type InactivePushSkipReason =
  | "profile_not_found"
  | "no_last_active_at"
  | "marketing_opt_out"
  | "not_inactive_enough"
  | "already_sent_this_streak"
  | "no_eligible_milestone_or_all_recorded"

export function describeInactivePushSkip(params: {
  lastActiveAtIso: string | null
  referenceTime: Date
  sentThisStreak: Set<KlaviyoInactivityMilestoneDays>
  marketingOptOut: boolean
}): { reason: InactivePushSkipReason; detail: string } | null {
  const { lastActiveAtIso, referenceTime, sentThisStreak, marketingOptOut } = params

  if (!lastActiveAtIso) {
    return {
      reason: "no_last_active_at",
      detail:
        "No last_active_at on profile — presence never recorded. User must sign in at least once.",
    }
  }

  if (marketingOptOut) {
    return {
      reason: "marketing_opt_out",
      detail: "Profile has marketing_emails_opt_out = true.",
    }
  }

  const inactiveDays = daysSinceLastActive(lastActiveAtIso, referenceTime)
  const qualifiesByTime = KLAVIYO_INACTIVITY_MILESTONE_DAYS.filter((d) =>
    isInactiveAtLeastDays(lastActiveAtIso, d, referenceTime),
  )

  if (qualifiesByTime.length === 0) {
    return {
      reason: "not_inactive_enough",
      detail: `Last active ${inactiveDays} day${inactiveDays === 1 ? "" : "s"} ago — need 3+ for the first tier.`,
    }
  }

  const pending = qualifiesByTime.filter((d) => !sentThisStreak.has(d))
  if (pending.length === 0) {
    const sent = [...sentThisStreak].sort((a, b) => a - b)
    return {
      reason: "already_sent_this_streak",
      detail: `Inactive ${inactiveDays} days; tier(s) ${sent.join(", ")}d already sent this streak. Use force resend to emit again.`,
    }
  }

  return null
}

export type PushKlaviyoInactiveForUserResult = {
  user_id: string
  last_active_at: string | null
  days_inactive: number | null
  strategy: KlaviyoInactiveBackfillStrategy
  force: boolean
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
  skipped_reason?: InactivePushSkipReason | string
  skipped_detail?: string
}

/**
 * Admin backfill: uses `profiles.last_active_at` (same signal as the users table) to decide
 * which **User Inactive N Days** metrics to send. Default strategy sends only the **highest**
 * qualifying tier not yet recorded this inactivity streak.
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
    .select("id, email, display_name, last_active_at, marketing_emails_opt_out")
    .eq("id", userId)
    .maybeSingle()

  if (pErr) {
    return {
      user_id: userId,
      last_active_at: null,
      days_inactive: null,
      strategy,
      force,
      milestones_attempted: [],
      sent: [],
      skipped_reason: pErr.message,
    }
  }

  if (!profile) {
    return {
      user_id: userId,
      last_active_at: null,
      days_inactive: null,
      strategy,
      force,
      milestones_attempted: [],
      sent: [],
      skipped_reason: "profile_not_found",
    }
  }

  const lastIso =
    typeof profile.last_active_at === "string" && profile.last_active_at.trim()
      ? profile.last_active_at.trim()
      : null

  const marketingOptOut = profile.marketing_emails_opt_out === true

  if (!lastIso) {
    const skip = describeInactivePushSkip({
      lastActiveAtIso: null,
      referenceTime,
      sentThisStreak: new Set(),
      marketingOptOut,
    })
    return {
      user_id: userId,
      last_active_at: null,
      days_inactive: null,
      strategy,
      force,
      milestones_attempted: [],
      sent: [],
      skipped_reason: skip?.reason ?? "no_last_active_at",
      skipped_detail: skip?.detail,
    }
  }

  const daysInactive = daysSinceLastActive(lastIso, referenceTime)

  const { days: sentThisStreak, error: sentErr } =
    await fetchInactiveMilestoneDaysSentThisStreak(supabase, userId, lastIso)

  if (sentErr) {
    return {
      user_id: userId,
      last_active_at: lastIso,
      days_inactive: daysInactive,
      strategy,
      force,
      milestones_attempted: [],
      sent: [],
      skipped_reason: `klaviyo_inactivity_milestones: ${sentErr}`,
    }
  }

  const milestones = pickMilestonesToSend(
    lastIso,
    referenceTime,
    sentThisStreak,
    strategy,
    force,
  )

  if (milestones.length === 0) {
    const skip = describeInactivePushSkip({
      lastActiveAtIso: lastIso,
      referenceTime,
      sentThisStreak,
      marketingOptOut,
    })
    return {
      user_id: userId,
      last_active_at: lastIso,
      days_inactive: daysInactive,
      strategy,
      force,
      milestones_attempted: [],
      sent: [],
      skipped_reason: skip?.reason ?? "no_eligible_milestone_or_all_recorded",
      skipped_detail: skip?.detail,
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

  const forceNonce = force ? String(Date.now()) : undefined
  const sent: PushKlaviyoInactiveForUserResult["sent"] = []

  for (const milestoneDays of milestones) {
    const uniqueIdSuffix = force
      ? `admin-${forceNonce}-${milestoneDays}d`
      : undefined

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
      const ins = await insertKlaviyoInactivityMilestoneSent(supabase, userId, milestoneDays)
      milestone_recorded = !ins.error
      record_error = ins.error ?? null
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
    days_inactive: daysInactive,
    strategy,
    force,
    milestones_attempted: milestones,
    sent,
  }
}
