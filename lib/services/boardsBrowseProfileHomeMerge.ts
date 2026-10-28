import type { ProfileBrowseHome } from "@/lib/db/profileBrowseHome"
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
  /** True when profile home area adjusted browse params. */
  homeFromProfile: boolean
  /** True when geo anchor came from profile (URL had no lat/lng). */
  geoFromProfile: boolean
}

function homeGeoComplete(home: ProfileBrowseHome): boolean {
  return (
    home.applyOnBoards &&
    home.lat != null &&
    home.lng != null &&
    home.radiusMi != null &&
    home.location.trim().length > 0
  )
}

/**
 * Applies the signed-in user's saved home area onto browse params when
 * `browse_home_apply_on_boards` is true. Geo fills in only when the URL has
 * no coordinates. Optional local-pickup-only adds `pickup=1`.
 */
export function mergeProfileBrowseHomeIntoBrowseParams(
  searchParams: BoardsBrowseSearchParams,
  home: ProfileBrowseHome | null | undefined,
): BoardsBrowseEffectiveFilters {
  if (!home?.applyOnBoards) {
    return {
      searchParams,
      homeFromProfile: false,
      geoFromProfile: false,
    }
  }

  const next: BoardsBrowseSearchParams = { ...searchParams }
  let geoFromProfile = false

  if (homeGeoComplete(home)) {
    const hasUrlGeo = boardsBrowseHasLatLng(searchParams.lat, searchParams.lng)
    if (!hasUrlGeo) {
      geoFromProfile = true
      next.location = home.location.trim()
      next.lat = String(home.lat)
      next.lng = String(home.lng)
      next.radius = home.radiusMi ?? undefined
    } else if (!next.radius?.trim() && home.radiusMi) {
      next.radius = home.radiusMi
    } else if (!next.location?.trim() && home.location.trim()) {
      next.location = home.location.trim()
    }
  }

  if (
    home.localPickupOnly &&
    !isBoardsBrowseLocalPickupAvailableParam(next.pickup)
  ) {
    next.pickup = "1"
  }

  return {
    searchParams: next,
    homeFromProfile: true,
    geoFromProfile,
  }
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

/** Redirect href when URL params should reflect an active profile home area. */
export function boardsBrowseProfileHomeRedirectHref(
  browsePath: string,
  rawSearchParams: BoardsBrowseSearchParams,
  merged: BoardsBrowseEffectiveFilters,
): string | null {
  if (!merged.homeFromProfile) return null
  if (browseParamsEqual(rawSearchParams, merged.searchParams)) return null
  const params = boardsBrowseSearchParamsToURLSearchParams(merged.searchParams)
  return boardsBrowsePathWithSearchParams(browsePath, params)
}
