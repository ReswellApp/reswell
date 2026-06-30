import type { SupabaseClient } from "@supabase/supabase-js"

export const KLAVIYO_INACTIVITY_MILESTONE_DAYS = [30] as const
export type KlaviyoInactivityMilestoneDays = (typeof KLAVIYO_INACTIVITY_MILESTONE_DAYS)[number]

export const KLAVIYO_INACTIVITY_MILESTONE_DAYS_VALUE = 30 as const

export type KlaviyoInactivityEligibleProfile = {
  id: string
  email: string | null
  display_name: string | null
  last_active_at: string
}

/**
 * Profiles whose last auth sign-in is strictly before `p_cutoff` and who have not yet
 * received this inactivity milestone event during the current streak.
 */
export async function fetchProfilesEligibleForKlaviyoInactivity(
  supabase: SupabaseClient,
  milestoneDays: KlaviyoInactivityMilestoneDays,
  cutoff: Date,
): Promise<{ data: KlaviyoInactivityEligibleProfile[]; error: string | null }> {
  const { data, error } = await supabase.rpc("profiles_eligible_for_klaviyo_inactivity", {
    p_milestone_days: milestoneDays,
    p_cutoff: cutoff.toISOString(),
  })

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = Array.isArray(data) ? data : []
  const typed: KlaviyoInactivityEligibleProfile[] = rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    email: typeof r.email === "string" ? r.email : null,
    display_name: typeof r.display_name === "string" ? r.display_name : null,
    last_active_at: String(r.last_active_at),
  }))

  return { data: typed, error: null }
}

/**
 * Record one or more milestones as sent **now** for a user (idempotent upsert).
 *
 * Upsert (not insert) so re-entry works: when a user reactivates and later goes
 * inactive again, the same `(user_id, milestone_days)` row is re-stamped with a
 * fresh `sent_at`, which the eligibility RPC compares against last sign-in.
 *
 * Pass every tier that should be suppressed for this send. When we emit the
 * highest pending tier (e.g. 30d), we also stamp the lower tiers (3d, 15d) so the
 * user does not also receive those stale lower-tier emails this streak.
 */
export async function recordKlaviyoInactivityMilestonesSent(
  supabase: SupabaseClient,
  userId: string,
  milestoneDays: KlaviyoInactivityMilestoneDays[],
): Promise<{ error: string | null }> {
  const unique = Array.from(new Set(milestoneDays))
  if (unique.length === 0) return { error: null }

  const sentAt = new Date().toISOString()
  const rows = unique.map((d) => ({
    user_id: userId,
    milestone_days: d,
    sent_at: sentAt,
  }))

  const { error } = await supabase
    .from("klaviyo_inactivity_milestones")
    .upsert(rows, { onConflict: "user_id,milestone_days" })

  if (error) return { error: error.message }
  return { error: null }
}

/** Record a single milestone as sent now (idempotent upsert). */
export async function insertKlaviyoInactivityMilestoneSent(
  supabase: SupabaseClient,
  userId: string,
  milestoneDays: KlaviyoInactivityMilestoneDays,
): Promise<{ error: string | null }> {
  return recordKlaviyoInactivityMilestonesSent(supabase, userId, [milestoneDays])
}

/** The configured inactive tier(s) at or below `maxDays` (always `[30]` today). */
export function inactivityMilestoneTiersUpTo(
  maxDays: KlaviyoInactivityMilestoneDays,
): KlaviyoInactivityMilestoneDays[] {
  return KLAVIYO_INACTIVITY_MILESTONE_DAYS.filter((d) => d <= maxDays)
}

/** Which inactive-milestone rows already exist for this user (idempotency / admin backfill). */
export async function fetchSentInactiveMilestoneDaysForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ days: Set<KlaviyoInactivityMilestoneDays>; error: string | null }> {
  const { data, error } = await supabase
    .from("klaviyo_inactivity_milestones")
    .select("milestone_days")
    .eq("user_id", userId)

  if (error) {
    return { days: new Set(), error: error.message }
  }

  const out = new Set<KlaviyoInactivityMilestoneDays>()
  for (const row of data ?? []) {
    const d = Number((row as { milestone_days?: number }).milestone_days)
    if (d === KLAVIYO_INACTIVITY_MILESTONE_DAYS_VALUE) out.add(d)
  }

  return { days: out, error: null }
}

/**
 * Milestones already emitted **during the current inactivity streak** — matches
 * `profiles_eligible_for_klaviyo_inactivity` (`sent_at > last sign-in anchor`).
 */
export async function fetchInactiveMilestoneDaysSentThisStreak(
  supabase: SupabaseClient,
  userId: string,
  lastActiveAtIso: string,
): Promise<{ days: Set<KlaviyoInactivityMilestoneDays>; error: string | null }> {
  const lastActiveMs = new Date(lastActiveAtIso).getTime()
  if (!Number.isFinite(lastActiveMs)) {
    return { days: new Set(), error: "invalid_last_active_at" }
  }

  const { data, error } = await supabase
    .from("klaviyo_inactivity_milestones")
    .select("milestone_days, sent_at")
    .eq("user_id", userId)

  if (error) {
    return { days: new Set(), error: error.message }
  }

  const out = new Set<KlaviyoInactivityMilestoneDays>()
  for (const row of data ?? []) {
    const d = Number((row as { milestone_days?: number }).milestone_days)
    const sentAtRaw = (row as { sent_at?: string }).sent_at
    const sentAtMs =
      typeof sentAtRaw === "string" ? new Date(sentAtRaw).getTime() : Number.NaN
    if (
      d === KLAVIYO_INACTIVITY_MILESTONE_DAYS_VALUE &&
      Number.isFinite(sentAtMs) &&
      sentAtMs > lastActiveMs
    ) {
      out.add(KLAVIYO_INACTIVITY_MILESTONE_DAYS_VALUE)
    }
  }

  return { days: out, error: null }
}
