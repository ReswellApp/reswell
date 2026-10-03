import { isInAppBrowser } from "./is-in-app-browser.ts"

/**
 * Horizontal distance that counts as a photo swipe. Shorter moves stay a tap
 * (open the enlarged photo). Vertical moves never count — the page must scroll.
 */
export const LISTING_GALLERY_SWIPE_SLOP_PX = 28

/**
 * Embla attaches a non-passive `touchmove` listener whenever `watchDrag` is
 * on. One of those listeners is empty; it exists only so a later handler can
 * `preventDefault()`. The listing hero is ~92svh, so the finger almost always
 * starts on the photo.
 *
 * The drag handler treats the gesture as horizontal as soon as sideways
 * movement exceeds vertical movement — often a pixel or two — and then
 * `preventDefault()`s every following touchmove. On iOS that fights
 * `touch-action: pan-y` and the tab stops taking touches until the browser
 * is quit. In-app browsers (Facebook, Instagram) ignore `touch-action`
 * entirely, so the same listener freezes those too.
 *
 * `watchDrag: false` is the only way to skip the listener. A `watchDrag`
 * callback that returns false still installs it. Phones and tablets use a
 * passive flick instead. In-app browsers are blocked even if they report a
 * fine pointer.
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
  return listingGalleryShouldBlockEmblaDrag(
    navigator.userAgent,
    window.matchMedia("(pointer: coarse)").matches,
  )
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
