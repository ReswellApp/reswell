import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import {
  fetchListingImageIdsForListing,
  fetchListingPdpCropOwnerRow,
  updateListingImagePdpCrops,
} from "@/lib/db/listing-pdp-crop"
import {
  clampListingPdpCrop,
  listingPdpCropActorIsOwner,
  type ListingPdpCrop,
} from "@/lib/utils/listing-pdp-crop"

export type SaveListingPdpCropsResult =
  | { ok: true; images: Array<ListingPdpCrop & { id: string }> }
  | { ok: false; status: number; error: string }

/**
 * Persist per-photo /l-page crop. Only the listing owner can write, through
 * their session and RLS. Admins and other signed-in users are rejected.
 * Browse tiles are not revalidated.
 */
export async function saveListingPdpCrops(
  supabase: SupabaseClient,
  params: {
    listingId: string
    actorUserId: string
    images: Array<ListingPdpCrop & { id: string }>
  },
): Promise<SaveListingPdpCropsResult> {
  const listingId = params.listingId.trim()
  if (!listingId) {
    return { ok: false, status: 400, error: "Missing listing id" }
  }

  const listing = await fetchListingPdpCropOwnerRow(supabase, listingId)
  if (!listing) {
    return { ok: false, status: 404, error: "Listing not found" }
  }

  if (!listingPdpCropActorIsOwner(params.actorUserId, listing.user_id)) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const ownedIds = new Set(await fetchListingImageIdsForListing(supabase, listingId))
  const nextImages = params.images.map((image) => ({
    id: image.id,
    ...clampListingPdpCrop(image),
  }))

  if (nextImages.some((image) => !ownedIds.has(image.id))) {
    return { ok: false, status: 400, error: "Photo is not on this listing" }
  }

  const written = await updateListingImagePdpCrops(supabase, listingId, nextImages)
  if (!written.ok) {
    console.error("[listingPdpCrop] update failed", written.message)
    return { ok: false, status: 500, error: "Could not save photo crop" }
  }

  revalidateListingDetailPage(listingId, listing.slug)
  return { ok: true, images: nextImages }
}
