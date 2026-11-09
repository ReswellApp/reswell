import type { MobileSellVideo } from "@reswell/api-contract"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mobileSellVideoInputError } from "@/lib/services/mobileSellVideoInput"
import {
  listingVideosToUpdateOps,
  syncListingVideos,
  type ListingVideoUpdateOp,
} from "@/lib/services/sync-listing-videos"
import { verifyListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"

export { mobileSellVideoInputError }

function optionalUrl(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function assertMobileSellVideos(
  videos: MobileSellVideo[] | undefined,
  userId: string,
): Promise<string | null> {
  if (videos == null) return null
  for (const video of videos) {
    const inputError = mobileSellVideoInputError(video, userId)
    if (inputError) return inputError
    const ok = await verifyListingImageObjectsExist(video.url, video.thumbnail_url)
    if (!ok) return "Upload the listing video again"
  }
  return null
}

function toUpdateOps(videos: MobileSellVideo[]): ListingVideoUpdateOp[] {
  return listingVideosToUpdateOps(
    videos.map((video, index) => ({
      id: video.video_id,
      url: video.url,
      thumbnailUrl: optionalUrl(video.thumbnail_url),
      contentType: video.content_type ?? null,
      durationSeconds: video.duration_seconds ?? null,
      byteSize: video.byte_size ?? null,
      sortOrder: index,
    })),
  )
}

export async function replaceListingVideos(
  supabase: SupabaseClient,
  listingId: string,
  videos: MobileSellVideo[],
): Promise<string | null> {
  const previous = await supabase.from("listing_videos").select("id").eq("listing_id", listingId)
  if (previous.error) {
    console.error("[mobile-api] listing_videos load failed", {
      listingId,
      message: previous.error.message,
    })
    return "Couldn't save the listing video"
  }
  const kept = new Set(videos.flatMap((video) => (video.video_id ? [video.video_id] : [])))
  const removedIds = (previous.data ?? [])
    .map((row) => row.id as string)
    .filter((id) => !kept.has(id))
  try {
    await syncListingVideos(supabase, listingId, removedIds, toUpdateOps(videos))
  } catch (error) {
    console.error("[mobile-api] listing_videos sync failed", {
      listingId,
      message: error instanceof Error ? error.message : String(error),
    })
    return "Couldn't save the listing video"
  }
  return null
}
