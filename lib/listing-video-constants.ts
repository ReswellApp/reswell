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

/** iOS/Safari HEVC MOVs can hang forever on `<video>` metadata. Fail the pick instead. */
export const LISTING_VIDEO_METADATA_TIMEOUT_MS = 15_000

/** Poster is optional — skip the frame if the decoder never seeks. */
export const LISTING_VIDEO_POSTER_TIMEOUT_MS = 20_000

/** No XHR progress for this long → treat the upload as stuck (cellular / Safari). */
export const LISTING_VIDEO_UPLOAD_STALL_MS = 45_000

const LISTING_VIDEO_UPLOAD_MIN_TIMEOUT_MS = 2 * 60_000
const LISTING_VIDEO_UPLOAD_MAX_TIMEOUT_MS = 15 * 60_000
const LISTING_VIDEO_UPLOAD_ASSUMED_BYTES_PER_SEC = 25 * 1024

/** Hard ceiling so a hung XHR cannot spin past 15 minutes on a 200MB file. */
export function listingVideoUploadTimeoutMs(byteSize: number): number {
  const size = Number.isFinite(byteSize) && byteSize > 0 ? byteSize : 0
  const estimatedMs =
    Math.ceil(size / LISTING_VIDEO_UPLOAD_ASSUMED_BYTES_PER_SEC) * 1000 + 30_000
  return Math.min(
    LISTING_VIDEO_UPLOAD_MAX_TIMEOUT_MS,
    Math.max(LISTING_VIDEO_UPLOAD_MIN_TIMEOUT_MS, estimatedMs),
  )
}
