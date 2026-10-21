/**
 * The mounted listing `<img>` already has a bitmap. This is the back-navigation
 * case: the browser decoded the photo on the way in, so the gray wave must not
 * paint over it. Checked on the element itself — a `new Image()` probe would
 * start a fetch and pull lazy tiles early.
 */
export function listingImageIsDecoded(
  img: { complete: boolean; naturalWidth: number } | null | undefined,
): boolean {
  return Boolean(img && img.complete && img.naturalWidth > 0)
}

/**
 * Sync cache probe for a single photo the shopper just asked to open (the
 * lightbox). Do not use this on a grid — assigning `src` starts a download.
 */
export function listingPhotoIsCached(src: string | undefined): boolean {
  if (!src || src === "/placeholder.svg" || typeof window === "undefined") return false
  const probe = new window.Image()
  probe.src = src
  return listingImageIsDecoded(probe)
}
