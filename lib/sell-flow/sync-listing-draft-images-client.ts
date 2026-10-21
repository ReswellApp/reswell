import type { SupabaseClient } from "@supabase/supabase-js"
import { purgeListingImageStorageAction } from "@/lib/actions/listingImageStoragePurge"
import {
  assignListingImageIdsFromExistingUrls,
  isListingImageUniqueViolation,
  listingImageUrlsEquivalent,
} from "@/lib/listing-image-identity"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"

/**
 * Fills ids for photos that are already rows. A draft autosave and publish can
 * both try to insert the same URL; the second caller must adopt the first row.
 */
export async function attachKnownListingImageIds(
  supabase: SupabaseClient,
  listingId: string,
  slots: ListingPhotoSlot[],
): Promise<ListingPhotoSlot[]> {
  if (!slots.some((slot) => !slot.id && slot.url?.trim())) return slots

  const { data, error } = await supabase
    .from("listing_images")
    .select("id, url")
    .eq("listing_id", listingId)
  if (error) throw new Error(error.message)

  const assigned = assignListingImageIdsFromExistingUrls(
    (data ?? []).map((row) => ({
      id: String(row.id),
      url: typeof row.url === "string" ? row.url : "",
    })),
    slots.map((slot) => ({ id: slot.id, url: slot.url ?? "" })),
  )

  if (assigned.duplicateRowIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("listing_images")
      .delete()
      .eq("listing_id", listingId)
      .in("id", assigned.duplicateRowIds)
    if (deleteError) throw new Error(deleteError.message)
  }

  return slots.map((slot, index) => {
    const id = assigned.images[index]?.id
    if (!id || slot.id === id) return slot
    return { ...slot, id }
  })
}

export async function insertListingImageReturningId(
  supabase: SupabaseClient,
  listingId: string,
  img: {
    url: string
    thumbnailUrl?: string | null
    isPrimary: boolean
    sortOrder: number
  },
): Promise<string> {
  const url = img.url.trim()
  const { data, error } = await supabase
    .from("listing_images")
    .insert({
      listing_id: listingId,
      url,
      thumbnail_url: img.thumbnailUrl ?? null,
      is_primary: img.isPrimary,
      sort_order: img.sortOrder,
    })
    .select("id")
    .single()

  if (!error && data?.id) return String(data.id)

  if (error && isListingImageUniqueViolation(error)) {
    const { data: rows, error: findError } = await supabase
      .from("listing_images")
      .select("id, url")
      .eq("listing_id", listingId)
    if (!findError) {
      const match = (rows ?? []).find((row) =>
        listingImageUrlsEquivalent(typeof row.url === "string" ? row.url : "", url),
      )
      if (match?.id) {
        const { error: updateError } = await supabase
          .from("listing_images")
          .update({
            sort_order: img.sortOrder,
            is_primary: img.isPrimary,
            url,
            thumbnail_url: img.thumbnailUrl ?? null,
          })
          .eq("id", match.id)
          .eq("listing_id", listingId)
        if (updateError) throw new Error(updateError.message)
        return String(match.id)
      }
    }
  }

  throw new Error(error?.message || "Photo could not be saved to your listing.")
}

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
    const { error: deleteError } = await supabase
      .from("listing_images")
      .delete()
      .in("id", removedIds)
      .eq("listing_id", listingId)
    if (deleteError) {
      throw new Error("Could not remove these photos from the listing.")
    }
  }

  const knownSlots = await attachKnownListingImageIds(supabase, listingId, slots)
  const adoptedExistingId = knownSlots.some((slot, index) => slot.id && slot.id !== slots[index]?.id)

  const newRows = knownSlots
    .map((img, index) => ({ img, index }))
    .filter(({ img }) => !img.id && img.url)

  const insertResults = await Promise.all(
    newRows.map(async ({ img, index }) => {
      const id = await insertListingImageReturningId(supabase, listingId, {
        url: img.url!,
        thumbnailUrl: img.thumbnailUrl ?? null,
        isPrimary: index === 0,
        sortOrder: index,
      })
      return { index, id }
    }),
  )

  let working = [...knownSlots]
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

  return {
    nextSlots: working,
    didInsert: insertResults.length > 0 || adoptedExistingId,
  }
}
