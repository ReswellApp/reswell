import * as FileSystem from "expo-file-system/legacy"
import type { ImagePickerAsset } from "expo-image-picker"
import type { SellVideo } from "@/lib/sell-flow"

/** Same limits as website `lib/listing-video-constants.ts`. */
export const LISTING_VIDEO_MAX_BYTES = 200 * 1024 * 1024
export const LISTING_VIDEO_MIN_DURATION_SECONDS = 6
export const LISTING_VIDEO_MAX_DURATION_SECONDS = 120

const LISTING_VIDEO_NAME_RE = /\.(mp4|mov|webm)$/i

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

export function isAcceptedListingVideo(mime: string | null | undefined, fileName: string | null | undefined): boolean {
  const type = (mime || "").toLowerCase()
  if (
    type === "video/mp4" ||
    type.startsWith("video/mp4;") ||
    type === "video/quicktime" ||
    type === "video/webm" ||
    type.startsWith("video/webm;")
  ) {
    return true
  }
  return LISTING_VIDEO_NAME_RE.test(fileName ?? "")
}

export type ListingVideoMime = "video/mp4" | "video/quicktime" | "video/webm"

export function normalizeListingVideoMime(
  mime: string | null | undefined,
  fileName: string | null | undefined,
): ListingVideoMime {
  const type = (mime ?? "").toLowerCase()
  const name = fileName ?? ""
  if (type === "video/quicktime" || /\.mov$/i.test(name)) return "video/quicktime"
  if (type === "video/webm" || type.startsWith("video/webm;") || /\.webm$/i.test(name)) return "video/webm"
  return "video/mp4"
}

export function listingVideoExtensionForMime(mime: ListingVideoMime): "mp4" | "mov" | "webm" {
  if (mime === "video/quicktime") return "mov"
  if (mime === "video/webm") return "webm"
  return "mp4"
}

/** ImagePicker documents milliseconds; some Android pickers return seconds. */
export function listingVideoDurationSecondsFromPicker(duration: number): number {
  if (duration > LISTING_VIDEO_MAX_DURATION_SECONDS * 2) return duration / 1000
  return duration
}

async function videoByteSize(uri: string, fileSize?: number): Promise<number> {
  if (typeof fileSize === "number" && Number.isFinite(fileSize) && fileSize > 0) return fileSize
  try {
    const info = await FileSystem.getInfoAsync(uri)
    if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) return info.size
  } catch {
    /* web / missing native FS */
  }
  return 0
}

/** Builds a local sell-video slot after the picker. Throws a user-facing error if the clip is invalid. */
export async function sellVideoFromPickerAsset(asset: ImagePickerAsset): Promise<SellVideo> {
  const fileName = asset.fileName ?? asset.uri
  if (!isAcceptedListingVideo(asset.mimeType, fileName)) {
    throw new Error("That video type isn't supported. Try an MP4, MOV, or WebM file.")
  }
  const byteSize = await videoByteSize(asset.uri, asset.fileSize)
  if (byteSize > LISTING_VIDEO_MAX_BYTES) {
    throw new Error(
      `This video is over 200MB. Choose a smaller file (yours is ${(byteSize / (1024 * 1024)).toFixed(1)}MB).`,
    )
  }
  const durationSeconds =
    typeof asset.duration === "number" && Number.isFinite(asset.duration) && asset.duration > 0
      ? listingVideoDurationSecondsFromPicker(asset.duration)
      : null
  if (durationSeconds == null) {
    throw new Error("We couldn't read this video. Try exporting it as an MP4 (H.264), then upload again.")
  }
  const durationError = listingVideoDurationViolation(durationSeconds)
  if (durationError) throw new Error(durationError)

  const mime = normalizeListingVideoMime(asset.mimeType, fileName)
  return {
    id: `${asset.assetId ?? asset.uri}-${Date.now()}`,
    uri: asset.uri,
    thumbnailUri: null,
    contentType: mime,
    durationSeconds,
    byteSize: byteSize > 0 ? byteSize : null,
    status: "idle",
  }
}
