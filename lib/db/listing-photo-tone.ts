import type { SupabaseClient } from "@supabase/supabase-js"
import {
  clampListingPhotoTone,
  type ListingPhotoTone,
} from "@/lib/utils/listing-photo-tone"

export type ListingPhotoToneListingRow = {
  id: string
  user_id: string
  slug: string | null
}

export type ListingPhotoToneImageRow = {
  id: string
  url: string
  thumbnail_url: string | null
}

export type ListingPhotoToneAdjustmentRow = {
  image_id: string
  listing_id: string
  source_url: string
  source_thumbnail_url: string | null
  rendition_url: string
  rendition_thumbnail_url: string | null
  brightness: number | string | null
  highlights: number | string | null
  shadows: number | string | null
  contrast: number | string | null
}

const IMAGE_COLUMNS = "id, url, thumbnail_url"
const ADJUSTMENT_COLUMNS =
  "image_id, listing_id, source_url, source_thumbnail_url, rendition_url, rendition_thumbnail_url, brightness, highlights, shadows, contrast"

export async function fetchListingPhotoToneListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingPhotoToneListingRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, user_id, slug")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data?.id || !data.user_id) return null
  return {
    id: data.id,
    user_id: data.user_id,
    slug: typeof data.slug === "string" ? data.slug : null,
  }
}

export async function fetchListingPhotoToneImages(
  supabase: SupabaseClient,
  listingId: string,
  imageIds: string[],
): Promise<{ data: ListingPhotoToneImageRow[]; error: string | null }> {
  if (imageIds.length === 0) return { data: [], error: null }
  const { data, error } = await supabase
    .from("listing_images")
    .select(IMAGE_COLUMNS)
    .eq("listing_id", listingId)
    .in("id", imageIds)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ListingPhotoToneImageRow[], error: null }
}

export async function fetchListingPhotoToneAdjustments(
  supabase: SupabaseClient,
  listingId: string,
  imageIds?: string[],
): Promise<{ data: ListingPhotoToneAdjustmentRow[]; error: string | null }> {
  let query = supabase
    .from("listing_image_adjustments")
    .select(ADJUSTMENT_COLUMNS)
    .eq("listing_id", listingId)
  if (imageIds) {
    if (imageIds.length === 0) return { data: [], error: null }
    query = query.in("image_id", imageIds)
  }

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ListingPhotoToneAdjustmentRow[], error: null }
}

export type ListingPhotoToneAdjustmentWrite = {
  imageId: string
  listingId: string
  sourceUrl: string
  sourceThumbnailUrl: string | null
  renditionUrl: string
  renditionThumbnailUrl: string | null
  tone: ListingPhotoTone
}

export async function upsertListingPhotoToneAdjustment(
  supabase: SupabaseClient,
  image: ListingPhotoToneAdjustmentWrite,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const tone = clampListingPhotoTone(image.tone)
  const { error } = await supabase.from("listing_image_adjustments").upsert(
    {
      image_id: image.imageId,
      listing_id: image.listingId,
      source_url: image.sourceUrl,
      source_thumbnail_url: image.sourceThumbnailUrl,
      rendition_url: image.renditionUrl,
      rendition_thumbnail_url: image.renditionThumbnailUrl,
      brightness: tone.brightness,
      highlights: tone.highlights,
      shadows: tone.shadows,
      contrast: tone.contrast,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "image_id" },
  )

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function deleteListingPhotoToneAdjustment(
  supabase: SupabaseClient,
  listingId: string,
  imageId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("listing_image_adjustments")
    .delete()
    .eq("image_id", imageId)
    .eq("listing_id", listingId)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** Point the listing at a rendition, or back at the original. Does not touch the recipe. */
export async function updateListingPhotoToneImageUrls(
  supabase: SupabaseClient,
  listingId: string,
  image: { id: string; url: string; thumbnailUrl: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("listing_images")
    .update({
      url: image.url,
      thumbnail_url: image.thumbnailUrl,
    })
    .eq("id", image.id)
    .eq("listing_id", listingId)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
