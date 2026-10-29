import * as FileSystem from "expo-file-system/legacy"
import type { MobileSellVideo } from "@reswell/api-contract"
import { getSupabase } from "@/lib/supabase"
import { publicSupabaseAnonKey, publicSupabaseUrl } from "@/lib/public-env"
import {
  listingVideoExtensionForMime,
  normalizeListingVideoMime,
  type ListingVideoMime,
} from "@/lib/sell-video"
import type { SellVideo } from "@/lib/sell-flow"

const UPLOAD_RETRY_ATTEMPTS = 2
const UPLOAD_RETRY_BASE_DELAY_MS = 600

function listingObjectPublicUrl(pathInBucket: string): string {
  const base = publicSupabaseUrl().replace(/\/$/, "")
  const encoded = pathInBucket
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${base}/storage/v1/object/public/listings/${encoded}`
}

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function uploadErrorMessage(status: number, body: string): string {
  let message = `Upload failed (${status})`
  try {
    const json = JSON.parse(body) as { message?: string; error?: string }
    if (typeof json.message === "string" && json.message.trim()) return json.message.trim()
    if (typeof json.error === "string" && json.error.trim()) return json.error.trim()
  } catch {
    if (body.trim()) message = body.trim().slice(0, 200)
  }
  return message
}

async function uploadListingVideoFile(opts: {
  pathInBucket: string
  fileUri: string
  contentType: string
  accessToken: string
  onProgress?: (ratio: number) => void
}): Promise<void> {
  const supabaseUrl = publicSupabaseUrl().replace(/\/$/, "")
  const anonKey = publicSupabaseAnonKey()
  if (!supabaseUrl || !anonKey) throw new Error("Upload is not configured.")
  const url = `${supabaseUrl}/storage/v1/object/listings/${encodeObjectPath(opts.pathInBucket)}`

  let lastError: unknown
  for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
    try {
      const task = FileSystem.createUploadTask(
        url,
        opts.fileUri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            apikey: anonKey,
            "Content-Type": opts.contentType,
            "x-upsert": "false",
            "cache-control": "max-age=31536000",
          },
        },
        (progress) => {
          const total = progress.totalBytesExpectedToSend
          if (total > 0) opts.onProgress?.(progress.totalBytesSent / total)
        },
      )
      const result = await task.uploadAsync()
      if (!result) throw new Error("Couldn't upload that video")
      if (result.status >= 200 && result.status < 300) return
      throw new Error(uploadErrorMessage(result.status, result.body))
    } catch (error) {
      lastError = error
      if (attempt >= UPLOAD_RETRY_ATTEMPTS) break
      await sleep(UPLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Couldn't upload that video")
}

/**
 * Streams the local clip into the `listings` bucket (RLS: `${uid}/…`).
 * Uses FileSystem so a 200MB file never has to sit in JS memory.
 */
export async function uploadSellVideoToListingsStorage(
  video: SellVideo,
  onProgress?: (ratio: number) => void,
): Promise<MobileSellVideo> {
  const supabase = getSupabase()
  if (!supabase) throw new Error("Sign in again to upload this video.")
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Sign in again to upload this video.")
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) throw new Error("Sign in again to upload this video.")

  const mime: ListingVideoMime = normalizeListingVideoMime(video.contentType, video.uri)
  const ext = listingVideoExtensionForMime(mime)
  const storageContentType: ListingVideoMime = mime === "video/quicktime" ? "video/mp4" : mime
  const stamp = `${Date.now()}-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2)
  }`
  const videoPath = `${user.id}/${stamp}-video.${ext}`

  try {
    await uploadListingVideoFile({
      pathInBucket: videoPath,
      fileUri: video.uri,
      contentType: storageContentType,
      accessToken,
      onProgress,
    })
  } catch (cause) {
    await supabase.storage.from("listings").remove([videoPath])
    throw cause instanceof Error ? cause : new Error("Couldn't upload that video")
  }

  return {
    url: listingObjectPublicUrl(videoPath),
    thumbnail_url: video.thumbnailUrl ?? null,
    content_type: storageContentType,
    duration_seconds: video.durationSeconds ?? null,
    byte_size: video.byteSize ?? null,
  }
}
