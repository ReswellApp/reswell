/**
 * Horizontal distance that counts as a photo swipe. Shorter moves stay a tap
 * (open the enlarged photo). Vertical moves never count — the page must scroll.
 */
export const LISTING_GALLERY_SWIPE_SLOP_PX = 28

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
