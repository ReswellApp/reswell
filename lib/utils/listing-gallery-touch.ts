/**
 * Horizontal distance that counts as a photo swipe. Shorter moves stay a tap
 * (open the enlarged photo). Vertical moves never count — the page must scroll.
 */
export const LISTING_GALLERY_SWIPE_SLOP_PX = 28

/**
 * Native `<video controls>` bar on the listing hero. Touches in this strip
 * scrub and pause; touches above it change slides.
 * The video swipe surface uses this same inset (`bottom` in px).
 */
export const LISTING_GALLERY_VIDEO_CONTROLS_STRIP_PX = 80

/**
 * This must stay boolean false. Embla installs a non-passive touchmove listener
 * for true and for callbacks, including callbacks that return false.
 */
export const LISTING_GALLERY_EMBLA_WATCH_DRAG = false

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

/**
 * True when a touch is on the native video control bar. Those touches scrub
 * playback and must not change slides.
 */
export function listingGalleryTouchOnVideoControls(
  clientY: number,
  videoBottom: number,
  stripPx = LISTING_GALLERY_VIDEO_CONTROLS_STRIP_PX,
): boolean {
  if (!Number.isFinite(clientY) || !Number.isFinite(videoBottom)) return false
  if (!Number.isFinite(stripPx) || stripPx < 0) return false
  return clientY >= videoBottom - stripPx
}
