import type { MobileSellVideo } from "@reswell/api-contract"
import {
  LISTING_VIDEO_MAX_BYTES,
  LISTING_VIDEO_MIME_TYPES,
} from "@/lib/listing-video-constants"
import { listingVideoDurationViolation } from "@/lib/listing-video-pipeline"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"

const ALLOWED_CONTENT_TYPES = new Set<string>([...LISTING_VIDEO_MIME_TYPES, "video/mp4"])

function ownedListingObject(url: string, userId: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!supabaseUrl) return false
  return url.startsWith(listingObjectPublicUrl(supabaseUrl, `${userId}/`))
}

function optionalUrl(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** Client-payload checks that do not hit storage. */
export function mobileSellVideoInputError(video: MobileSellVideo, userId: string): string | null {
  if (!ownedListingObject(video.url, userId)) {
    return "Upload the listing video again"
  }
  const thumb = optionalUrl(video.thumbnail_url)
  if (thumb && !ownedListingObject(thumb, userId)) {
    return "Upload the listing video again"
  }
  const mime = video.content_type?.trim().toLowerCase() ?? ""
  if (mime && !ALLOWED_CONTENT_TYPES.has(mime) && !mime.startsWith("video/mp4;")) {
    return "That video type isn't supported. Try an MP4, MOV, or WebM file."
  }
  if (video.byte_size != null && video.byte_size > LISTING_VIDEO_MAX_BYTES) {
    return `This video is over 200MB. Choose a smaller file (yours is ${(video.byte_size / (1024 * 1024)).toFixed(1)}MB).`
  }
  if (video.duration_seconds != null) {
    return listingVideoDurationViolation(video.duration_seconds)
  }
  return null
}
