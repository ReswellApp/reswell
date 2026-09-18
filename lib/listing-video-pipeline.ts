/**
 * Client-side listing video constraints for /sell uploads.
 * Sized for Meta catalog (≤200MB direct file) and Google Merchant (6–240s).
 */

import {
  LISTING_VIDEO_ACCEPT,
  LISTING_VIDEO_MAX_BYTES,
  LISTING_VIDEO_MAX_COUNT,
  LISTING_VIDEO_MAX_DURATION_SECONDS,
  LISTING_VIDEO_METADATA_TIMEOUT_MS,
  LISTING_VIDEO_MIN_DURATION_SECONDS,
  LISTING_VIDEO_MIME_TYPES,
  LISTING_VIDEO_POSTER_TIMEOUT_MS,
  type ListingVideoMimeType,
} from "./listing-video-constants.ts"

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
  if (
    mime === "video/mp4" ||
    mime.startsWith("video/mp4;") ||
    mime === "video/quicktime" ||
    mime === "video/webm" ||
    mime.startsWith("video/webm;")
  ) {
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

export type ListingVideoDurationRead = {
  durationSeconds: number | null
  timedOut: boolean
}

export type ListingVideoPrepareOptions = {
  timeoutMs?: number
  signal?: AbortSignal
}

function applyListingVideoElementHints(video: HTMLVideoElement): void {
  video.muted = true
  video.playsInline = true
  video.setAttribute("playsinline", "")
  video.setAttribute("webkit-playsinline", "")
}

function listingVideoPrepareAborted(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted)
}

export function listingVideoDurationViolation(durationSeconds: number): string | null {
  if (durationSeconds < LISTING_VIDEO_MIN_DURATION_SECONDS) {
    return `Videos need to be at least ${LISTING_VIDEO_MIN_DURATION_SECONDS} seconds for ads (yours is ${Math.round(durationSeconds)}s).`
  }
  if (durationSeconds > LISTING_VIDEO_MAX_DURATION_SECONDS) {
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = Math.round(durationSeconds % 60)
    return `Videos can be up to 2 minutes long (yours is ${minutes}:${String(seconds).padStart(2, "0")}). Trim it and try again.`
  }
  return null
}

/**
 * Reads video duration via an off-screen <video> element. Times out on iOS/Safari
 * HEVC hangs instead of leaving the sell tile spinning forever.
 */
export function readListingVideoDurationSeconds(
  file: File,
  opts?: ListingVideoPrepareOptions,
): Promise<ListingVideoDurationRead> {
  const timeoutMs = opts?.timeoutMs ?? LISTING_VIDEO_METADATA_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    if (listingVideoPrepareAborted(opts?.signal)) {
      reject(new DOMException("Upload aborted", "AbortError"))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"
    applyListingVideoElementHints(video)

    let settled = false
    const finish = (result: ListingVideoDurationRead | null, err?: DOMException) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      opts?.signal?.removeEventListener("abort", onAbort)
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute("src")
      try {
        video.load()
      } catch {
        /* iOS can throw after revoke */
      }
      if (err) {
        reject(err)
        return
      }
      resolve(result ?? { durationSeconds: null, timedOut: false })
    }

    const onAbort = () => {
      finish(null, new DOMException("Upload aborted", "AbortError"))
    }
    opts?.signal?.addEventListener("abort", onAbort)

    const timer = window.setTimeout(() => {
      finish({ durationSeconds: null, timedOut: true })
    }, timeoutMs)

    video.onloadedmetadata = () => {
      finish({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        timedOut: false,
      })
    }
    video.onerror = () => finish({ durationSeconds: null, timedOut: false })
    video.src = objectUrl
    try {
      video.load()
    } catch {
      finish({ durationSeconds: null, timedOut: false })
    }
  })
}

export async function assertListingVideoDuration(
  file: File,
  opts?: ListingVideoPrepareOptions,
): Promise<number | null> {
  const { durationSeconds, timedOut } = await readListingVideoDurationSeconds(file, opts)
  if (listingVideoPrepareAborted(opts?.signal)) {
    throw new DOMException("Upload aborted", "AbortError")
  }
  if (timedOut) {
    throw new Error(
      "We couldn't read this video. Try exporting it as an MP4 (H.264), then upload again.",
    )
  }
  if (durationSeconds == null) return null
  const violation = listingVideoDurationViolation(durationSeconds)
  if (violation) throw new Error(violation)
  return durationSeconds
}

export function normalizeListingVideoMimeType(file: File): ListingVideoMimeType {
  const type = file.type.toLowerCase()
  if (type === "video/quicktime" || /\.mov$/i.test(file.name)) return "video/quicktime"
  if (type === "video/webm" || type.startsWith("video/webm;") || /\.webm$/i.test(file.name)) {
    return "video/webm"
  }
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
 * the browser cannot decode a frame — including iOS/Safari hangs after timeout.
 */
export function captureListingVideoPosterBlob(
  file: File,
  opts?: ListingVideoPrepareOptions,
): Promise<{
  blob: Blob
  contentType: "image/webp" | "image/jpeg"
  ext: "webp" | "jpg"
} | null> {
  const timeoutMs = opts?.timeoutMs ?? LISTING_VIDEO_POSTER_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    if (listingVideoPrepareAborted(opts?.signal)) {
      reject(new DOMException("Upload aborted", "AbortError"))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "auto"
    applyListingVideoElementHints(video)

    let settled = false
    const cleanup = () => {
      window.clearTimeout(timer)
      opts?.signal?.removeEventListener("abort", onAbort)
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute("src")
      try {
        video.load()
      } catch {
        /* iOS can throw after revoke */
      }
    }

    const succeed = (value: {
      blob: Blob
      contentType: "image/webp" | "image/jpeg"
      ext: "webp" | "jpg"
    } | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    const fail = () => succeed(null)

    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException("Upload aborted", "AbortError"))
    }
    opts?.signal?.addEventListener("abort", onAbort)

    const timer = window.setTimeout(fail, timeoutMs)

    video.onerror = fail

    let captureStarted = false
    const startCapture = () => {
      if (captureStarted || settled) return
      captureStarted = true
      const seekTo = Number.isFinite(video.duration) && video.duration > 0.2 ? 0.1 : 0
      const onSeeked = () => {
        if (settled) return
        try {
          const w = video.videoWidth
          const h = video.videoHeight
          if (!w || !h) {
            fail()
            return
          }
          // Sharper sell-grid / PDP posters (was 640 — looked soft on retina tiles).
          const maxLong = 1280
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
                succeed({ blob: webpBlob, contentType: "image/webp", ext: "webp" })
                return
              }
              canvas.toBlob(
                (jpegBlob) => {
                  if (!jpegBlob) {
                    fail()
                    return
                  }
                  succeed({ blob: jpegBlob, contentType: "image/jpeg", ext: "jpg" })
                },
                "image/jpeg",
                0.92,
              )
            },
            "image/webp",
            0.92,
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

    video.onloadeddata = startCapture
    video.onloadedmetadata = startCapture
    video.src = objectUrl
    try {
      video.load()
    } catch {
      fail()
    }
  })
}
