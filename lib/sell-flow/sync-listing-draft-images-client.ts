import type { SupabaseClient } from "@supabase/supabase-js"
import { purgeListingImageStorageAction } from "@/lib/actions/listingImageStoragePurge"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"

/**
 * Writes current photo URLs to `listing_images` for a draft (or live) listing.
 */
export async function syncListingDraftImagesClient(
  supabase: SupabaseClient,
  listingId: string,
  slots: ListingPhotoSlot[],
  removedIds: string[],
): Promise<{ nextSlots: ListingPhotoSlot[]; didInsert: boolean }> {
  if (removedIds.length) {
    const purge = await purgeListingImageStorageAction({
      listingId,
      imageRowIds: removedIds,
    })
    if ("error" in purge) {
      throw new Error(
        typeof purge.error === "string"
          ? purge.error
          : "Could not remove old photos from storage.",
      )
    }
    await supabase
      .from("listing_images")
      .delete()
      .in("id", removedIds)
      .eq("listing_id", listingId)
  }

  const newRows = slots
    .map((img, index) => ({ img, index }))
    .filter(({ img }) => !img.id && img.url)

  const insertResults = await Promise.all(
    newRows.map(async ({ img, index }) => {
      const { data: inserted, error: insertError } = await supabase
        .from("listing_images")
        .insert({
          listing_id: listingId,
          url: img.url!,
          thumbnail_url: img.thumbnailUrl ?? null,
          is_primary: index === 0,
          sort_order: index,
        })
        .select("id")
        .single()

      if (insertError || !inserted?.id) {
        throw new Error(
          insertError?.message || `Photo ${index + 1} could not be saved to your listing.`,
        )
      }
      return { index, id: inserted.id as string }
    }),
  )

  let working = [...slots]
  if (insertResults.length) {
    for (const { index, id } of insertResults) {
      working[index] = { ...working[index], id }
    }
  }

  await Promise.all(
    working.map(async (img, index) => {
      if (!img.id) return
      const url = (img.url ?? "").trim()
      const thumb = (img.thumbnailUrl ?? "").trim()
      const { error } = await supabase
        .from("listing_images")
        .update({
          sort_order: index,
          is_primary: index === 0,
          ...(url ? { url, thumbnail_url: thumb || null } : {}),
        })
        .eq("id", img.id)
        .eq("listing_id", listingId)
      if (error) {
        throw new Error(`Could not update photo order (image ${index + 1}).`)
      }
    }),
  )

  return { nextSlots: working, didInsert: insertResults.length > 0 }
}
