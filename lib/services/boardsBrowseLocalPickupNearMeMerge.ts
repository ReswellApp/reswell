import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getLocalPickupNearMePreferenceForUser,
  type LocalPickupNearMePreference,
} from "@/lib/db/localPickupNearMePreference"
import { normalizeBoardBrowseRadius } from "@/lib/boards-browse-location"
import {
  boardsBrowseHasLatLng,
  boardsBrowsePathWithSearchParams,
  boardsBrowseSearchParamsToURLSearchParams,
  parseBoardsBrowseCoord,
} from "@/lib/utils/boards-browse-geocode"
import {
  isBoardsBrowseLocalPickupAvailableParam,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"

export type BoardsBrowseEffectiveFilters = {
  searchParams: BoardsBrowseSearchParams
  /** True when the saved near-me preference forced local pickup filtering. */
  localPickupFromPreference: boolean
  /** True when geo anchor came from the saved preference (URL had no lat/lng). */
  geoFromPreference: boolean
}

function prefIsComplete(pref: LocalPickupNearMePreference): boolean {
  return (
    pref.enabled &&
    pref.lat != null &&
    pref.lng != null &&
    pref.radiusMi != null &&
    pref.location.trim().length > 0
  )
}

/**
 * Applies the signed-in user's saved local-pickup-near-me preference onto browse
 * params. Preference geo fills in only when the URL has no coordinates; local
 * pickup filtering is always enforced while the preference is enabled.
 */
export function mergeLocalPickupNearMeIntoBrowseParams(
  searchParams: BoardsBrowseSearchParams,
  pref: LocalPickupNearMePreference | null | undefined,
): BoardsBrowseEffectiveFilters {
  if (!pref || !pref.enabled) {
    return {
      searchParams,
      localPickupFromPreference: false,
      geoFromPreference: false,
    }
  }

  const next: BoardsBrowseSearchParams = { ...searchParams }
  let geoFromPreference = false

  if (prefIsComplete(pref)) {
    const hasUrlGeo = boardsBrowseHasLatLng(searchParams.lat, searchParams.lng)
    if (!hasUrlGeo) {
      geoFromPreference = true
      next.location = pref.location.trim()
      next.lat = String(pref.lat)
      next.lng = String(pref.lng)
      next.radius = pref.radiusMi ?? undefined
    } else if (!next.radius?.trim() && pref.radiusMi) {
      next.radius = pref.radiusMi
    } else if (!next.location?.trim() && pref.location.trim()) {
      next.location = pref.location.trim()
    }
  }

  if (!isBoardsBrowseLocalPickupAvailableParam(next.pickup)) {
    next.pickup = "1"
  }

  return {
    searchParams: next,
    localPickupFromPreference: true,
    geoFromPreference,
  }
}

export async function loadMergedBoardsBrowseFilters(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  searchParams: BoardsBrowseSearchParams,
): Promise<BoardsBrowseEffectiveFilters> {
  if (!userId) {
    return mergeLocalPickupNearMeIntoBrowseParams(searchParams, null)
  }
  const pref = await getLocalPickupNearMePreferenceForUser(supabase, userId)
  return mergeLocalPickupNearMeIntoBrowseParams(searchParams, pref)
}

function browseParamsEqual(a: BoardsBrowseSearchParams, b: BoardsBrowseSearchParams): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const av = a[key as keyof BoardsBrowseSearchParams]?.trim() ?? ""
    const bv = b[key as keyof BoardsBrowseSearchParams]?.trim() ?? ""
    if (key === "radius") {
      if (normalizeBoardBrowseRadius(av || null) !== normalizeBoardBrowseRadius(bv || null)) {
        return false
      }
      continue
    }
    if (key === "lat" || key === "lng") {
      const pa = parseBoardsBrowseCoord(av || undefined)
      const pb = parseBoardsBrowseCoord(bv || undefined)
      if (pa !== pb) return false
      continue
    }
    if (av !== bv) return false
  }
  return true
}

/** Redirect href when URL params should reflect an active near-me preference. */
export function boardsBrowseLocalPickupNearMeRedirectHref(
  browsePath: string,
  rawSearchParams: BoardsBrowseSearchParams,
  merged: BoardsBrowseEffectiveFilters,
): string | null {
  if (!merged.localPickupFromPreference) return null
  if (browseParamsEqual(rawSearchParams, merged.searchParams)) return null
  const params = boardsBrowseSearchParamsToURLSearchParams(merged.searchParams)
  return boardsBrowsePathWithSearchParams(browsePath, params)
}
