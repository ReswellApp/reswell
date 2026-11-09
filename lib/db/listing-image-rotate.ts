import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isListingPdpCropDefault,
  type ListingPdpCrop,
} from "@/lib/utils/listing-pdp-crop"

export type ListingImageRotateRow = {
  id: string
  url: string
  thumbnail_url: string | null
  pdp_crop_zoom: number | null
  pdp_crop_x: number | null
  pdp_crop_y: number | null
}

export async function fetchListingImageForRotate(
  supabase: SupabaseClient,
  listingId: string,
  imageId: string,
): Promise<ListingImageRotateRow | null> {
  const { data, error } = await supabase
    .from("listing_images")
    .select("id, url, thumbnail_url, pdp_crop_zoom, pdp_crop_x, pdp_crop_y")
    .eq("listing_id", listingId)
    .eq("id", imageId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as ListingImageRotateRow
  if (!row.id || !row.url?.trim()) return null
  return row
}

export async function updateListingImageAfterRotate(
  supabase: SupabaseClient,
  listingId: string,
  imageId: string,
  next: {
    url: string
    thumbnailUrl: string
    crop: ListingPdpCrop | null
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const crop = next.crop && !isListingPdpCropDefault(next.crop) ? next.crop : null
  const { error } = await supabase
    .from("listing_images")
    .update({
      url: next.url,
      thumbnail_url: next.thumbnailUrl,
      pdp_crop_zoom: crop?.zoom ?? null,
      pdp_crop_x: crop?.x ?? null,
      pdp_crop_y: crop?.y ?? null,
    })
    .eq("id", imageId)
    .eq("listing_id", listingId)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
