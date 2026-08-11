/**
 * Client-side listing video constraints for /sell uploads.
 * Sized for Meta catalog (≤200MB direct file) and Google Merchant (6–240s).
 */

import {
  LISTING_VIDEO_ACCEPT,
  LISTING_VIDEO_MAX_BYTES,
  LISTING_VIDEO_MAX_COUNT,
  LISTING_VIDEO_MAX_DURATION_SECONDS,
  LISTING_VIDEO_MIN_DURATION_SECONDS,
  LISTING_VIDEO_MIME_TYPES,
  type ListingVideoMimeType,
} from "@/lib/listing-video-constants"

export {
  LISTING_VIDEO_ACCEPT,
  LISTING_VIDEO_MAX_BYTES,
  LISTING_VIDEO_MAX_COUNT,
  LISTING_VIDEO_MAX_DURATION_SECONDS,
  LISTING_VIDEO_MIN_DURATION_SECONDS,
  LISTING_VIDEO_MIME_TYPES,
  type ListingVideoMimeType,
}

const LISTING_VIDEO_NAME_RE = /\.(mp4|mov|webm)$/i

export function isAcceptedListingVideoFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (mime === "video/mp4" || mime === "video/quicktime" || mime === "video/webm") {
    return true
  }
  return LISTING_VIDEO_NAME_RE.test(file.name)
}

export function assertAcceptedListingVideoFile(file: File): void {
  if (!isAcceptedListingVideoFile(file)) {
    throw new Error("That video type isn't supported. Try an MP4, MOV, or WebM file.")
  }
}

export function assertListingVideoOriginalSize(file: File): void {
  if (file.size > LISTING_VIDEO_MAX_BYTES) {
    throw new Error(
      `This video is over 200MB. Choose a smaller file (yours is ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    )
  }
}

/**
 * Reads video duration via an off-screen <video> element. Returns null when the
 * browser cannot decode metadata (size still caps those uploads).
 */
export function readListingVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"

    const finish = (duration: number | null) => {
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute("src")
      video.load()
      resolve(duration)
    }

    video.onloadedmetadata = () => {
      finish(Number.isFinite(video.duration) ? video.duration : null)
    }
    video.onerror = () => finish(null)
    video.src = objectUrl
  })
}

export async function assertListingVideoDuration(file: File): Promise<number | null> {
  const duration = await readListingVideoDurationSeconds(file)
  if (duration == null) return null

  if (duration < LISTING_VIDEO_MIN_DURATION_SECONDS) {
    throw new Error(
      `Videos need to be at least ${LISTING_VIDEO_MIN_DURATION_SECONDS} seconds for ads (yours is ${Math.round(duration)}s).`,
    )
  }
  if (duration > LISTING_VIDEO_MAX_DURATION_SECONDS) {
    const minutes = Math.floor(duration / 60)
    const seconds = Math.round(duration % 60)
    throw new Error(
      `Videos can be up to 2 minutes long (yours is ${minutes}:${String(seconds).padStart(2, "0")}). Trim it and try again.`,
    )
  }
  return duration
}

export function normalizeListingVideoMimeType(file: File): ListingVideoMimeType {
  const type = file.type.toLowerCase()
  if (type === "video/quicktime" || /\.mov$/i.test(file.name)) return "video/quicktime"
  if (type === "video/webm" || /\.webm$/i.test(file.name)) return "video/webm"
  return "video/mp4"
}

export function listingVideoExtensionForMime(
  mime: ListingVideoMimeType,
): "mp4" | "mov" | "webm" {
  if (mime === "video/quicktime") return "mov"
  if (mime === "video/webm") return "webm"
  return "mp4"
}

/**
 * Capture a poster frame near 0.1s for PDP / sell thumbs. Returns null when
 * the browser cannot decode a frame.
 */
export function captureListingVideoPosterBlob(file: File): Promise<{
  blob: Blob
  contentType: "image/webp" | "image/jpeg"
  ext: "webp" | "jpg"
} | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "auto"
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute("src")
      video.load()
    }

    const fail = () => {
      cleanup()
      resolve(null)
    }

    video.onerror = fail
    video.onloadeddata = () => {
      const seekTo = Number.isFinite(video.duration) && video.duration > 0.2 ? 0.1 : 0
      const onSeeked = () => {
        try {
          const w = video.videoWidth
          const h = video.videoHeight
          if (!w || !h) {
            fail()
            return
          }
          const maxLong = 640
          const long = Math.max(w, h)
          const scale = long > maxLong ? maxLong / long : 1
          const canvas = document.createElement("canvas")
          canvas.width = Math.max(1, Math.round(w * scale))
          canvas.height = Math.max(1, Math.round(h * scale))
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            fail()
            return
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(
            (webpBlob) => {
              if (webpBlob) {
                cleanup()
                resolve({ blob: webpBlob, contentType: "image/webp", ext: "webp" })
                return
              }
              canvas.toBlob(
                (jpegBlob) => {
                  cleanup()
                  if (!jpegBlob) {
                    resolve(null)
                    return
                  }
                  resolve({ blob: jpegBlob, contentType: "image/jpeg", ext: "jpg" })
                },
                "image/jpeg",
                0.85,
              )
            },
            "image/webp",
            0.85,
          )
        } catch {
          fail()
        }
      }
      video.onseeked = onSeeked
      try {
        video.currentTime = seekTo
      } catch {
        onSeeked()
      }
    }
    video.src = objectUrl
  })
}
