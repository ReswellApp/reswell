import type { SupabaseClient } from "@supabase/supabase-js"
import {
  LISTING_VIDEO_UPLOAD_STALL_MS,
  listingVideoUploadTimeoutMs,
  type ListingVideoMimeType,
} from "@/lib/listing-video-constants"
import {
  listingVideoExtensionForMime,
  normalizeListingVideoMimeType,
} from "@/lib/listing-video-pipeline"
import { listingObjectPublicUrl, uploadStorageObjectWithProgress } from "@/lib/supabase/storage-upload-xhr"
import { isRetryableListingVideoUploadError } from "@/lib/utils/listing-video-upload-retry"

const POSTER_UPLOAD_STALL_MS = 15_000
const UPLOAD_RETRY_ATTEMPTS = 2
const UPLOAD_RETRY_BASE_DELAY_MS = 600

async function assertListingUploadAuth(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("Sign in again to upload this video.")
  }
  return user.id
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Upload aborted", "AbortError"))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

async function uploadListingBlobWithProgress(opts: {
  supabaseUrl: string
  accessToken: string
  anonKey: string
  pathInBucket: string
  body: Blob
  contentType: string
  stallTimeoutMs: number
  timeoutMs: number
  onProgress?: (loaded: number, total: number) => void
  signal?: AbortSignal
}): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException("Upload aborted", "AbortError")
    }
    try {
      await uploadStorageObjectWithProgress({
        supabaseUrl: opts.supabaseUrl,
        accessToken: opts.accessToken,
        anonKey: opts.anonKey,
        bucket: "listings",
        pathInBucket: opts.pathInBucket,
        body: opts.body,
        contentType: opts.contentType,
        upsert: false,
        cacheControl: "31536000",
        stallTimeoutMs: opts.stallTimeoutMs,
        timeoutMs: opts.timeoutMs,
        signal: opts.signal,
        onProgress: opts.onProgress
          ? (p) => opts.onProgress?.(p.loaded, p.total)
          : undefined,
      })
      return
    } catch (err) {
      lastError = err
      if (!isRetryableListingVideoUploadError(err) || attempt >= UPLOAD_RETRY_ATTEMPTS) {
        throw err
      }
      await sleep(UPLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), opts.signal)
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed")
}

export type UploadedListingVideo = {
  url: string
  thumbnailUrl: string | null
  contentType: ListingVideoMimeType
  durationSeconds: number | null
  byteSize: number
}

export async function uploadListingVideoToSupabase(opts: {
  supabase: SupabaseClient
  clientId: string
  file: File
  durationSeconds: number | null
  poster?: { blob: Blob; contentType: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" } | null
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}): Promise<UploadedListingVideo> {
  const userId = await assertListingUploadAuth(opts.supabase)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!supabaseUrl || !anonKey) {
    throw new Error("Upload is not configured.")
  }

  const {
    data: { session },
  } = await opts.supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) {
    throw new Error("Sign in again to upload this video.")
  }

  if (opts.signal?.aborted) {
    throw new DOMException("Upload aborted", "AbortError")
  }

  const mime = normalizeListingVideoMimeType(opts.file)
  const ext = listingVideoExtensionForMime(mime)
  // Chrome/Android skip `video/quicktime`. Store MOV as MP4 so the object plays.
  const storageContentType: ListingVideoMimeType =
    mime === "video/quicktime" ? "video/mp4" : mime
  const ts = Date.now()
  const videoPath = `${userId}/${ts}-${opts.clientId}-video.${ext}`

  let thumbnailUrl: string | null = null
  if (opts.poster) {
    const posterPath = `${userId}/${ts}-${opts.clientId}-video-poster.${opts.poster.ext}`
    opts.onProgress?.(0.12)
    await uploadListingBlobWithProgress({
      supabaseUrl,
      accessToken,
      anonKey,
      pathInBucket: posterPath,
      body: opts.poster.blob,
      contentType: opts.poster.contentType,
      stallTimeoutMs: POSTER_UPLOAD_STALL_MS,
      timeoutMs: 60_000,
      signal: opts.signal,
    })
    thumbnailUrl = listingObjectPublicUrl(supabaseUrl, posterPath)
  }

  opts.onProgress?.(0.15)
  await uploadListingBlobWithProgress({
    supabaseUrl,
    accessToken,
    anonKey,
    pathInBucket: videoPath,
    body: opts.file,
    contentType: storageContentType,
    stallTimeoutMs: LISTING_VIDEO_UPLOAD_STALL_MS,
    timeoutMs: listingVideoUploadTimeoutMs(opts.file.size),
    signal: opts.signal,
    onProgress: (loaded, total) => {
      const ratio = total > 0 ? loaded / total : 0
      opts.onProgress?.(0.15 + ratio * 0.85)
    },
  })

  return {
    url: listingObjectPublicUrl(supabaseUrl, videoPath),
    thumbnailUrl,
    contentType: storageContentType,
    durationSeconds: opts.durationSeconds,
    byteSize: opts.file.size,
  }
}
