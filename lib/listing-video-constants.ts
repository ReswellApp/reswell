/** Shared listing video limits (sell upload + Meta/Google catalog eligibility). */

export const LISTING_VIDEO_MAX_BYTES = 200 * 1024 * 1024
export const LISTING_VIDEO_MIN_DURATION_SECONDS = 6
export const LISTING_VIDEO_MAX_DURATION_SECONDS = 120
export const LISTING_VIDEO_MAX_COUNT = 1

export const LISTING_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const

export type ListingVideoMimeType = (typeof LISTING_VIDEO_MIME_TYPES)[number]

export const LISTING_VIDEO_ACCEPT =
  "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
