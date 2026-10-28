import type { SupabaseClient } from "@supabase/supabase-js"
import { BOARD_RADIUS_VALUES, normalizeBoardBrowseRadius } from "@/lib/boards-browse-location"

export type ProfileBrowseHomeRow = {
  browse_home_location: string | null
  browse_home_lat: number | null
  browse_home_lng: number | null
  browse_home_radius_mi: string | null
  browse_home_apply_on_boards: boolean
  browse_home_local_pickup_only: boolean
}

export type ProfileBrowseHome = {
  applyOnBoards: boolean
  localPickupOnly: boolean
  location: string
  lat: number | null
  lng: number | null
  radiusMi: (typeof BOARD_RADIUS_VALUES)[number] | null
}

const EMPTY: ProfileBrowseHome = {
  applyOnBoards: false,
  localPickupOnly: false,
  location: "",
  lat: null,
  lng: null,
  radiusMi: null,
}

function rowToBrowseHome(row: ProfileBrowseHomeRow | null): ProfileBrowseHome {
  if (!row) return EMPTY

  const radiusRaw = normalizeBoardBrowseRadius(row.browse_home_radius_mi)
  const radiusMi =
    radiusRaw === "any" ? null : (radiusRaw as (typeof BOARD_RADIUS_VALUES)[number])

  return {
    applyOnBoards: row.browse_home_apply_on_boards === true,
    localPickupOnly: row.browse_home_local_pickup_only === true,
    location: row.browse_home_location?.trim() ?? "",
    lat: typeof row.browse_home_lat === "number" ? row.browse_home_lat : null,
    lng: typeof row.browse_home_lng === "number" ? row.browse_home_lng : null,
    radiusMi,
  }
}

const BROWSE_HOME_SELECT =
  "browse_home_location, browse_home_lat, browse_home_lng, browse_home_radius_mi, browse_home_apply_on_boards, browse_home_local_pickup_only"

export async function getProfileBrowseHomeForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileBrowseHome> {
  const { data, error } = await supabase
    .from("profiles")
    .select(BROWSE_HOME_SELECT)
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[profileBrowseHome] get:", error.message)
    return EMPTY
  }

  return rowToBrowseHome((data as ProfileBrowseHomeRow | null) ?? null)
}

export async function updateProfileBrowseHomeForUser(
  supabase: SupabaseClient,
  userId: string,
  home: ProfileBrowseHome,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload = home.applyOnBoards
    ? {
        browse_home_apply_on_boards: true,
        browse_home_local_pickup_only: home.localPickupOnly,
        browse_home_location: home.location.trim() || null,
        browse_home_lat: home.lat,
        browse_home_lng: home.lng,
        browse_home_radius_mi: home.radiusMi,
      }
    : {
        browse_home_apply_on_boards: false,
        browse_home_local_pickup_only: home.localPickupOnly,
        browse_home_location: home.location.trim() || null,
        browse_home_lat: home.lat,
        browse_home_lng: home.lng,
        browse_home_radius_mi: home.radiusMi,
      }

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId)

  if (error) {
    console.error("[profileBrowseHome] update:", error.message)
    return { ok: false, error: "Failed to save home area." }
  }

  return { ok: true }
}
