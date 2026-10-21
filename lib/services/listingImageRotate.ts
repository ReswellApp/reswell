import type { SupabaseClient } from "@supabase/supabase-js"
import { expirePublicListingSurfacesAfterEdit } from "@/lib/cache/revalidate-listing-after-edit"
import {
  fetchListingImageForRotate,
  updateListingImageAfterRotate,
} from "@/lib/db/listing-image-rotate"
import { fetchListingPdpCropOwnerRow } from "@/lib/db/listing-pdp-crop"
import {
  renderRotatedListingDerivatives,
  type RotatedListingDerivatives,
} from "@/lib/media/rotate-listing-derivatives"
import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-src"
import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"
import type { ListingPhotoQuarterTurnDelta } from "@/lib/sell-flow/listing-photo-orientation"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"
import {
  listingPdpCropActorIsOwner,
  listingPdpCropFromImageRow,
  rotateListingPdpCropClockwise,
  type ListingPdpCrop,
} from "@/lib/utils/listing-pdp-crop"

const LISTINGS_BUCKET = "listings"

export type RotatedListingImage = {
  id: string
  url: string
  thumbnailUrl: string
  crop: ListingPdpCrop | null
}

export type RotateListingImageResult =
  | { ok: true; image: RotatedListingImage }
  | { ok: false; status: number; error: string }

async function uploadDerivative(
  supabase: SupabaseClient,
  path: string,
  body: Buffer,
): Promise<void> {
  const { error } = await supabase.storage.from(LISTINGS_BUCKET).upload(path, body, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "31536000",
  })
  if (error) throw new Error(error.message || "Upload failed")
}

/**
 * Rewrites one gallery photo 90°, 180°, or 270° clockwise and stores new
 * derivatives. Only the listing owner can write, through their session.
 */
export async function rotateListingImage(
  supabase: SupabaseClient,
  params: {
    listingId: string
    imageId: string
    actorUserId: string
    quarterTurns: ListingPhotoQuarterTurnDelta
  },
): Promise<RotateListingImageResult> {
  const listingId = params.listingId.trim()
  const imageId = params.imageId.trim()
  if (!listingId || !imageId) {
    return { ok: false, status: 400, error: "Missing photo" }
  }

  const listing = await fetchListingPdpCropOwnerRow(supabase, listingId)
  if (!listing) {
    return { ok: false, status: 404, error: "Listing not found" }
  }
  if (!listingPdpCropActorIsOwner(params.actorUserId, listing.user_id)) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const row = await fetchListingImageForRotate(supabase, listingId, imageId)
  if (!row) {
    return { ok: false, status: 404, error: "Photo not found" }
  }

  const objectPath = listingStorageObjectPathFromUrl(row.url)
  if (!objectPath) {
    return { ok: false, status: 400, error: "This photo can't be rotated" }
  }

  const downloaded = await supabase.storage.from(LISTINGS_BUCKET).download(objectPath)
  if (downloaded.error || !downloaded.data) {
    console.error(
      "[listingImageRotate] download failed",
      downloaded.error?.message ?? "empty",
    )
    return { ok: false, status: 500, error: "Could not load this photo to rotate it" }
  }

  const input = Buffer.from(await downloaded.data.arrayBuffer())
  if (input.length === 0) {
    return { ok: false, status: 500, error: "Could not load this photo to rotate it" }
  }

  let derivatives: RotatedListingDerivatives
  try {
    derivatives = await renderRotatedListingDerivatives(input, params.quarterTurns)
  } catch (error) {
    console.error(
      "[listingImageRotate] render failed",
      error instanceof Error ? error.message : "render failed",
    )
    return { ok: false, status: 500, error: "Could not rotate this photo" }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!supabaseUrl) {
    return { ok: false, status: 500, error: "Could not rotate this photo" }
  }

  const stamp = Date.now()
  const folder = params.actorUserId
  const fullPath = `${folder}/${stamp}-${imageId}-full.webp`
  const thumbPath = `${folder}/${stamp}-${imageId}-thumb.webp`
  const cardPath = `${folder}/${stamp}-${imageId}-card2.webp`
  const filmPath = `${folder}/${stamp}-${imageId}-film2.webp`
  const uploadedPaths = [thumbPath, filmPath, cardPath, fullPath]

  try {
    await uploadDerivative(supabase, thumbPath, derivatives.thumb)
    await uploadDerivative(supabase, filmPath, derivatives.film)
    await uploadDerivative(supabase, cardPath, derivatives.card)
    await uploadDerivative(supabase, fullPath, derivatives.full)
  } catch (error) {
    console.error(
      "[listingImageRotate] upload failed",
      error instanceof Error ? error.message : "upload failed",
    )
    await supabase.storage.from(LISTINGS_BUCKET).remove(uploadedPaths)
    return { ok: false, status: 500, error: "Could not save the rotated photo" }
  }

  const url = listingObjectPublicUrl(supabaseUrl, fullPath)
  const thumbnailUrl = listingObjectPublicUrl(supabaseUrl, thumbPath)
  const crop = rotateListingPdpCropClockwise(
    listingPdpCropFromImageRow(row),
    params.quarterTurns,
  )

  const written = await updateListingImageAfterRotate(supabase, listingId, imageId, {
    url,
    thumbnailUrl,
    crop,
  })
  if (!written.ok) {
    console.error("[listingImageRotate] update failed", written.message)
    await supabase.storage.from(LISTINGS_BUCKET).remove(uploadedPaths)
    return { ok: false, status: 500, error: "Could not save the rotated photo" }
  }

  const previousUrls = [row.url, row.thumbnail_url].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  )
  await removeListingImageFilesFromStorage(supabase, previousUrls, [url, thumbnailUrl])
  expirePublicListingSurfacesAfterEdit(listingId, listing.slug)

  return {
    ok: true,
    image: { id: imageId, url, thumbnailUrl, crop },
  }
}
