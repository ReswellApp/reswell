import type { SupabaseClient } from "@supabase/supabase-js"
import { BOARD_RADIUS_VALUES, normalizeBoardBrowseRadius } from "@/lib/boards-browse-location"

export type LocalPickupNearMePreferenceRow = {
  local_pickup_near_me_enabled: boolean
  local_pickup_near_me_location: string | null
  local_pickup_near_me_lat: number | null
  local_pickup_near_me_lng: number | null
  local_pickup_near_me_radius_mi: string | null
}

export type LocalPickupNearMePreference = {
  enabled: boolean
  location: string
  lat: number | null
  lng: number | null
  radiusMi: (typeof BOARD_RADIUS_VALUES)[number] | null
}

function rowToPreference(row: LocalPickupNearMePreferenceRow | null): LocalPickupNearMePreference {
  if (!row?.local_pickup_near_me_enabled) {
    return {
      enabled: false,
      location: "",
      lat: null,
      lng: null,
      radiusMi: null,
    }
  }

  const radiusRaw = normalizeBoardBrowseRadius(row.local_pickup_near_me_radius_mi)
  const radiusMi =
    radiusRaw === "any"
      ? null
      : (radiusRaw as (typeof BOARD_RADIUS_VALUES)[number])

  return {
    enabled: true,
    location: row.local_pickup_near_me_location?.trim() ?? "",
    lat: typeof row.local_pickup_near_me_lat === "number" ? row.local_pickup_near_me_lat : null,
    lng: typeof row.local_pickup_near_me_lng === "number" ? row.local_pickup_near_me_lng : null,
    radiusMi,
  }
}

export async function getLocalPickupNearMePreferenceForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<LocalPickupNearMePreference> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "local_pickup_near_me_enabled, local_pickup_near_me_location, local_pickup_near_me_lat, local_pickup_near_me_lng, local_pickup_near_me_radius_mi",
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[localPickupNearMePreference] get:", error.message)
    return rowToPreference(null)
  }

  return rowToPreference((data as LocalPickupNearMePreferenceRow | null) ?? null)
}

export async function upsertLocalPickupNearMePreferenceForUser(
  supabase: SupabaseClient,
  userId: string,
  pref: LocalPickupNearMePreference,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload = pref.enabled
    ? {
        user_id: userId,
        local_pickup_near_me_enabled: true,
        local_pickup_near_me_location: pref.location.trim() || null,
        local_pickup_near_me_lat: pref.lat,
        local_pickup_near_me_lng: pref.lng,
        local_pickup_near_me_radius_mi: pref.radiusMi,
      }
    : {
        user_id: userId,
        local_pickup_near_me_enabled: false,
        local_pickup_near_me_location: null,
        local_pickup_near_me_lat: null,
        local_pickup_near_me_lng: null,
        local_pickup_near_me_radius_mi: null,
      }

  const { error } = await supabase.from("notification_preferences").upsert(payload, {
    onConflict: "user_id",
  })

  if (error) {
    console.error("[localPickupNearMePreference] upsert:", error.message)
    return { ok: false, error: "Failed to save preference." }
  }

  return { ok: true }
}
