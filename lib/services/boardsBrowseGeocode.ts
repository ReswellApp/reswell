import { getCachedForwardGeocodePlace } from "@/lib/cache/forward-geocode-place"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import {
  boardsBrowseNeedsGeocodePersist,
  boardsBrowsePathWithSearchParams,
  boardsBrowseSearchParamsWithGeocode,
} from "@/lib/utils/boards-browse-geocode"

/**
 * When the URL has a place string but no lat/lng, resolve once and persist coords
 * so later filter/page navigations skip the geocoder.
 */
export async function resolveBoardsBrowseGeocodeRedirectHref(
  browsePath: string,
  searchParams: BoardsBrowseSearchParams,
): Promise<string | null> {
  const location = searchParams.location?.trim() ?? ""
  if (!boardsBrowseNeedsGeocodePersist({ ...searchParams, location })) return null

  const geo = await getCachedForwardGeocodePlace(location)
  if (!geo) return null

  return boardsBrowsePathWithSearchParams(
    browsePath,
    boardsBrowseSearchParamsWithGeocode(searchParams, geo),
  )
}
