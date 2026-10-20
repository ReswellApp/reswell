/**
 * Center a listing photo, then scale until both edges of its box are covered.
 * In-flow thumbs (the image is the box) use this. Framed layers use
 * {@link listingPhotoFillClassName}. Enlarge (lightbox) opts out and shows
 * the full photo.
 */
export const listingPhotoCoverClassName = "max-w-none object-cover object-center"

/** Same cover rule, pinned to a positioned frame (tiles, filmstrips, heroes). */
export const listingPhotoFillClassName =
  `absolute inset-0 h-full w-full ${listingPhotoCoverClassName}`
