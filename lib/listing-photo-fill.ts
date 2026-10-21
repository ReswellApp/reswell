import type { CSSProperties } from "react"

/**
 * Center a listing photo, then scale until both edges of its box are covered.
 * In-flow thumbs (the image is the box) use this. Framed layers use
 * {@link listingPhotoFillClassName}. Enlarge (lightbox) opts out and shows
 * the full photo.
 */
export const listingPhotoCoverClassName = "max-w-none object-cover object-center"

/**
 * Marker for framed listing photos. `img:not([data-nimg]) { height: auto }` in
 * globals.css beats Tailwind `h-full`, which leaves a white band under any
 * photo that is not already 3:4. This class opts out of that rule.
 */
export const LISTING_PHOTO_FILL_CLASS = "listing-photo-fill"

/** Same cover rule, pinned to a positioned frame (tiles, filmstrips, heroes). */
export const listingPhotoFillClassName =
  `absolute inset-0 h-full w-full ${LISTING_PHOTO_FILL_CLASS} ${listingPhotoCoverClassName}`

/**
 * The /l hero box: pin the bitmap to the frame, then scale until both edges
 * are covered. Inline so it wins over the global `height: auto` rule on raw
 * `<img>` (marketplace cards use `/media/listings`, which is not `next/image`).
 */
export const listingPhotoFrameFillStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  maxWidth: "none",
  objectFit: "cover",
  objectPosition: "center center",
}
