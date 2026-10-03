import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isListingPdpCropDefault,
  type ListingPdpCrop,
} from "@/lib/utils/listing-pdp-crop"

export type ListingPdpCropWrite = ListingPdpCrop & { id: string }

export type ListingPdpCropListingRow = {
  id: string
  user_id: string
  slug: string | null
}

export async function fetchListingPdpCropOwnerRow(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingPdpCropListingRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, user_id, slug")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingPdpCropListingRow
}

export async function fetchListingImageIdsForListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("listing_images")
    .select("id")
    .eq("listing_id", listingId)

  if (error || !data) return []
  return data
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter((id) => id.length > 0)
}

function cropRowUpdate(crop: ListingPdpCrop): {
  pdp_crop_zoom: number | null
  pdp_crop_x: number | null
  pdp_crop_y: number | null
} {
  if (isListingPdpCropDefault(crop)) {
    return { pdp_crop_zoom: null, pdp_crop_x: null, pdp_crop_y: null }
  }
  return {
    pdp_crop_zoom: crop.zoom,
    pdp_crop_x: crop.x,
    pdp_crop_y: crop.y,
  }
}

/** Writes PDP crop columns only. Tile denorm columns stay untouched. */
export async function updateListingImagePdpCrops(
  supabase: SupabaseClient,
  listingId: string,
  crops: ListingPdpCropWrite[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const crop of crops) {
    const { error } = await supabase
      .from("listing_images")
      .update(cropRowUpdate(crop))
      .eq("id", crop.id)
      .eq("listing_id", listingId)

    if (error) {
      return { ok: false, message: error.message }
    }
  }
  return { ok: true }
}
