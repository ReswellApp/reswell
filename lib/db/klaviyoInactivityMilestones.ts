import type { SupabaseClient } from "@supabase/supabase-js"

export const KLAVIYO_INACTIVITY_MILESTONE_DAYS = [3, 15, 30] as const
export type KlaviyoInactivityMilestoneDays = (typeof KLAVIYO_INACTIVITY_MILESTONE_DAYS)[number]

export type KlaviyoInactivityEligibleProfile = {
  id: string
  email: string | null
  display_name: string | null
  last_active_at: string
}

/**
 * Profiles whose `last_active_at` is strictly before `p_cutoff` and who have not yet
 * received this inactivity milestone event.
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

export async function insertKlaviyoInactivityMilestoneSent(
  supabase: SupabaseClient,
  userId: string,
  milestoneDays: KlaviyoInactivityMilestoneDays,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("klaviyo_inactivity_milestones").insert({
    user_id: userId,
    milestone_days: milestoneDays,
  })

  if (error) return { error: error.message }
  return { error: null }
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
    if (d === 3 || d === 15 || d === 30) out.add(d as KlaviyoInactivityMilestoneDays)
  }

  return { days: out, error: null }
}
