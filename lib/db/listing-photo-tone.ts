import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listingPhotoToneColumnValues,
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
  tone_source_url: string | null
  tone_source_thumbnail_url: string | null
  tone_brightness: number | null
  tone_highlights: number | null
  tone_shadows: number | null
  tone_contrast: number | null
}

const IMAGE_COLUMNS =
  "id, url, thumbnail_url, tone_source_url, tone_source_thumbnail_url, tone_brightness, tone_highlights, tone_shadows, tone_contrast"

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
  const { data, error } = await supabase
    .from("listing_images")
    .select(IMAGE_COLUMNS)
    .eq("listing_id", listingId)
    .in("id", imageIds)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ListingPhotoToneImageRow[], error: null }
}

export type ListingPhotoToneImageUpdate = {
  id: string
  url: string
  thumbnailUrl: string | null
  sourceUrl: string | null
  sourceThumbnailUrl: string | null
  tone: ListingPhotoTone
}

export async function updateListingPhotoToneImage(
  supabase: SupabaseClient,
  listingId: string,
  image: ListingPhotoToneImageUpdate,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("listing_images")
    .update({
      url: image.url,
      thumbnail_url: image.thumbnailUrl,
      tone_source_url: image.sourceUrl,
      tone_source_thumbnail_url: image.sourceThumbnailUrl,
      ...listingPhotoToneColumnValues(image.tone),
    })
    .eq("id", image.id)
    .eq("listing_id", listingId)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
