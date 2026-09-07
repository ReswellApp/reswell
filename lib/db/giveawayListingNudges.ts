import type { SupabaseClient } from "@supabase/supabase-js"

import type { GiveawayEntryStatus, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

export const GIVEAWAY_LISTING_REMINDER_STALE_HOURS = 2 as const
export const GIVEAWAY_LISTING_REMINDER_CRON_BATCH = 40 as const

export type GiveawayListingNudgeRow = {
  id: string
  user_id: string
  giveaway_slug: string
  preferred_brand: GiveawayPrizeBrandId | null
  status: GiveawayEntryStatus
  listing_id: string | null
  created_at: string
  email: string | null
  display_name: string | null
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function giveawayListingReminderCutoff(
  referenceTime: Date,
  minAgeHours: number,
): Date {
  return new Date(referenceTime.getTime() - minAgeHours * 60 * 60 * 1000)
}

/**
 * Open raffle entries that still have no listing ticket and have not been nudged.
 */
export async function fetchEligibleGiveawayListingReminders(
  supabase: SupabaseClient,
  params: {
    giveawaySlugs: string[]
    staleBefore: Date
    limit?: number
  },
): Promise<{ data: GiveawayListingNudgeRow[]; error: string | null }> {
  const slugs = params.giveawaySlugs.filter((slug) => slug.trim().length > 0)
  if (slugs.length === 0) {
    return { data: [], error: null }
  }

  const limit = params.limit ?? GIVEAWAY_LISTING_REMINDER_CRON_BATCH
  const fetchLimit = Math.min(Math.max(limit * 3, limit), 120)

  const { data, error } = await supabase
    .from("giveaway_entries")
    .select("id, user_id, giveaway_slug, preferred_brand, status, listing_id, created_at")
    .in("giveaway_slug", slugs)
    .eq("status", "pending")
    .is("listing_id", null)
    .lte("created_at", params.staleBefore.toISOString())
    .order("created_at", { ascending: true })
    .limit(fetchLimit)

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = (data ?? []) as Array<{
    id: string
    user_id: string
    giveaway_slug: string
    preferred_brand: string | null
    status: string
    listing_id: string | null
    created_at: string
  }>

  if (rows.length === 0) {
    return { data: [], error: null }
  }

  const entryIds = rows.map((row) => row.id)
  const userIds = [...new Set(rows.map((row) => row.user_id))]

  const [nudgedRes, profilesRes] = await Promise.all([
    supabase.from("giveaway_listing_klaviyo_nudges").select("entry_id").in("entry_id", entryIds),
    supabase.from("profiles").select("id, email, display_name").in("id", userIds),
  ])

  if (nudgedRes.error) {
    return { data: [], error: nudgedRes.error.message }
  }

  const nudgedIds = new Set(
    (nudgedRes.data ?? [])
      .map((row) => (typeof row.entry_id === "string" ? row.entry_id : ""))
      .filter(Boolean),
  )
  const profiles = new Map(
    (profilesRes.data ?? []).map((profile) => [profile.id, profile]),
  )

  const mapped: GiveawayListingNudgeRow[] = []
  for (const row of rows) {
    if (nudgedIds.has(row.id)) continue
    if (!row.id || !row.user_id || !row.created_at) continue
    const profile = profiles.get(row.user_id)
    mapped.push({
      id: row.id,
      user_id: row.user_id,
      giveaway_slug: row.giveaway_slug,
      preferred_brand: (row.preferred_brand as GiveawayPrizeBrandId | null) ?? null,
      status: row.status as GiveawayEntryStatus,
      listing_id: row.listing_id,
      created_at: row.created_at,
      email: asOptionalString(profile?.email),
      display_name: asOptionalString(profile?.display_name),
    })
    if (mapped.length >= limit) break
  }

  return { data: mapped, error: null }
}

export async function recordGiveawayListingNudgeSent(
  supabase: SupabaseClient,
  entryId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("giveaway_listing_klaviyo_nudges").upsert(
    {
      entry_id: entryId,
      user_id: userId,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "entry_id" },
  )
  if (error) return { error: error.message }
  return { error: null }
}
