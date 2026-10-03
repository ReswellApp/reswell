import { isInAppBrowser } from "./is-in-app-browser.ts"

/**
 * Horizontal distance that counts as a photo swipe. Shorter moves stay a tap
 * (open the enlarged photo). Vertical moves never count — the page must scroll.
 */
export const LISTING_GALLERY_SWIPE_SLOP_PX = 28

/**
 * Embla attaches a non-passive `touchmove` whenever `watchDrag` is on, then
 * `preventDefault()`s once sideways movement beats vertical movement. The
 * listing hero is ~92svh, so that swipe starts on the photo and iOS locks the
 * tab. `touch-action: pan-y` on the same hero does not fix it: the photo
 * cannot scroll, the gesture is never claimed, and the tab locks the same way.
 *
 * `watchDrag: false` is the only way to skip the listener. A `watchDrag`
 * callback that returns false still installs it. Phones change photos with a
 * passive flick instead. In-app browsers ignore `touch-action` entirely, so
 * they are blocked even when they report a fine pointer.
 */
export function listingGalleryShouldBlockEmblaDrag(
  userAgent: string | null | undefined,
  coarsePointer = false,
): boolean {
  return coarsePointer || isInAppBrowser(userAgent)
}

/** True when this document should not install Embla's touch listeners. */
export function listingGalleryBlocksEmblaDragNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  const coarse = window.matchMedia("(pointer: coarse), (any-pointer: coarse)").matches
  return listingGalleryShouldBlockEmblaDrag(navigator.userAgent, coarse)
}

/**
 * `1` = next photo, `-1` = previous. `null` when the gesture is a tap or a
 * vertical scroll and must not change slides.
 */
export function listingGallerySwipeDirection(
  dx: number,
  dy: number,
  slop = LISTING_GALLERY_SWIPE_SLOP_PX,
): -1 | 1 | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (Math.abs(dx) < slop) return null
  if (Math.abs(dx) <= Math.abs(dy)) return null
  return dx < 0 ? 1 : -1
}
