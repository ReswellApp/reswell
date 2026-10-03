import { isInAppBrowser } from "./is-in-app-browser.ts"

/**
 * Horizontal distance that counts as a photo swipe. Shorter moves stay a tap
 * (open the enlarged photo). Vertical moves never count — the page must scroll.
 */
export const LISTING_GALLERY_SWIPE_SLOP_PX = 28

/**
 * Embla attaches a non-passive `touchmove` listener so it can `preventDefault()`
 * during a horizontal drag. Facebook and Instagram in-app browsers ignore
 * `touch-action`, so that listener freezes the document: the listing hero is
 * ~92svh, the finger starts on the photo, and the page never scrolls.
 *
 * `watchDrag: false` is the only way to skip the listener. A `watchDrag`
 * callback that returns false still installs it.
 */
export function listingGalleryShouldBlockEmblaDrag(
  userAgent: string | null | undefined,
): boolean {
  return isInAppBrowser(userAgent)
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
