/**
 * URLs this document has already drawn. Soft navigation remounts tiles but
 * keeps this module alive, so back from `/l` can skip the white shimmer
 * without probing `Image()` (that probe starts a fetch and defeats lazy load).
 */
const paintedListingPhotoUrls = new Set<string>()

export function rememberPaintedListingPhoto(src: string | undefined): void {
  if (!src || src === "/placeholder.svg") return
  paintedListingPhotoUrls.add(src)
}

export function listingPhotoWasPainted(src: string | undefined): boolean {
  if (!src || src === "/placeholder.svg") return false
  return paintedListingPhotoUrls.has(src)
}

/** Test hook. Production code only adds URLs. */
export function clearPaintedListingPhotos(): void {
  paintedListingPhotoUrls.clear()
}

/**
 * Whether a listing photo well should treat its bitmap as already on screen.
 *
 * Back from `/l` (and every other soft navigation) remounts the tile. The
 * near-white shimmer must not cover a URL this document already drew.
 * A candidate change with nothing painted yet starts over. Otherwise a
 * decoded photo stays painted — a mount effect must not clear it.
 */
export function resolveListingPhotoPainted(input: {
  candidatesChanged: boolean
  cached: boolean
  loaded: boolean
}): boolean {
  if (input.cached) return true
  if (input.candidatesChanged) return false
  return input.loaded
}

/**
 * Sync cache probe. `img.complete` is true on the first tick when this URL
 * is already decoded, which is the back-navigation case.
 */
export function listingPhotoIsCached(src: string | undefined): boolean {
  if (!src || src === "/placeholder.svg" || typeof window === "undefined") return false
  const probe = new window.Image()
  probe.src = src
  return probe.complete && probe.naturalWidth > 0
}
