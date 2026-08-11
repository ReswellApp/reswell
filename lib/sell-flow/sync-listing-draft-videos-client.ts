import type { SupabaseClient } from "@supabase/supabase-js"
import { purgeListingVideoStorageAction } from "@/lib/actions/listingVideoStoragePurge"
import type { ListingVideoSlot } from "@/lib/sell-flow/listing-video-slot"

/**
 * Writes the current optional listing video to `listing_videos` from the browser.
 * Storage purge for removed rows goes through a server action (keeps `revalidateTag`
 * out of the client bundle).
 */
export async function syncListingDraftVideosClient(
  supabase: SupabaseClient,
  listingId: string,
  video: ListingVideoSlot | null,
  removedIds: string[],
): Promise<{ nextVideo: ListingVideoSlot | null }> {
  if (removedIds.length > 0) {
    const purge = await purgeListingVideoStorageAction({
      listingId,
      videoRowIds: removedIds,
    })
    if ("error" in purge) {
      throw new Error(
        typeof purge.error === "string"
          ? purge.error
          : "Could not remove old video from storage.",
      )
    }
    await supabase
      .from("listing_videos")
      .delete()
      .in("id", removedIds)
      .eq("listing_id", listingId)
  }

  if (!video?.url?.trim() || video.status !== "ready") {
    return { nextVideo: null }
  }

  if (video.id) {
    const { error } = await supabase
      .from("listing_videos")
      .update({
        url: video.url.trim(),
        thumbnail_url: video.thumbnailUrl,
        content_type: video.contentType,
        duration_seconds: video.durationSeconds,
        byte_size: video.byteSize,
        sort_order: 0,
      })
      .eq("id", video.id)
      .eq("listing_id", listingId)
    if (error) throw new Error(error.message)
    return { nextVideo: video }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("listing_videos")
    .insert({
      listing_id: listingId,
      url: video.url.trim(),
      thumbnail_url: video.thumbnailUrl,
      content_type: video.contentType,
      duration_seconds: video.durationSeconds,
      byte_size: video.byteSize,
      sort_order: 0,
    })
    .select("id")
    .single()

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message || "Video could not be saved to your listing.")
  }

  return {
    nextVideo: {
      ...video,
      id: inserted.id as string,
    },
  }
}
