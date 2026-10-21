import { syncListingImagesAction } from "@/lib/actions/syncListingImages"
import { listingImageUrlsEquivalent } from "@/lib/listing-image-identity"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import type { SyncedListingImage } from "@/lib/services/sync-listing-images"

/**
 * Sends the desired gallery to the server reconcile and stamps the returned
 * row ids onto the slots. Does not insert `listing_images` from the browser.
 */
export async function syncListingDraftImagesClient(
  listingId: string,
  slots: ListingPhotoSlot[],
  removedIds: string[],
): Promise<{ nextSlots: ListingPhotoSlot[]; didInsert: boolean }> {
  const images = slots.flatMap((slot, index) => {
    const url = slot.url?.trim()
    if (!url) return []
    return [
      {
        id: slot.id,
        url,
        thumbnailUrl: slot.thumbnailUrl ?? null,
        isPrimary: index === 0,
        sortOrder: index,
      },
    ]
  })

  const result = await syncListingImagesAction({
    listingId,
    removedImageIds: removedIds,
    images,
  })
  if ("error" in result) throw new Error(result.error)

  return applySyncedListingImageIds(slots, result.images)
}

function applySyncedListingImageIds(
  slots: ListingPhotoSlot[],
  images: SyncedListingImage[],
): { nextSlots: ListingPhotoSlot[]; didInsert: boolean } {
  const used = new Set<string>()
  let didInsert = false
  const nextSlots = slots.map((slot) => {
    const url = slot.url?.trim()
    if (!url) return slot
    const match = images.find((img) => {
      if (used.has(img.id)) return false
      if (slot.id && img.id === slot.id) return true
      return listingImageUrlsEquivalent(img.url, url)
    })
    if (!match) return slot
    used.add(match.id)
    if (slot.id === match.id) return slot
    didInsert = true
    return { ...slot, id: match.id }
  })
  return { nextSlots, didInsert }
}
