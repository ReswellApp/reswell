import type { SupabaseClient } from "@supabase/supabase-js"
import { klaviyoEmailListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import { primaryListingImageUrl } from "@/lib/listing-metadata"

type ListingImageRow = {
  listing_id: string
  url: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

/**
 * Batch-load primary listing photo URLs for Klaviyo commerce / email events.
 * Returns absolute HTTPS URLs suitable for email `<img src>`.
 */
export async function fetchPrimaryListingImageUrlsForKlaviyo(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("listing_images")
    .select("listing_id, url, thumbnail_url, is_primary, sort_order")
    .in("listing_id", uniqueIds)

  if (error) {
    console.error("[klaviyo] listing_images fetch:", error.message)
    return new Map()
  }

  const byListing = new Map<string, ListingImageRow[]>()
  for (const row of (data ?? []) as ListingImageRow[]) {
    const bucket = byListing.get(row.listing_id) ?? []
    bucket.push(row)
    byListing.set(row.listing_id, bucket)
  }

  const result = new Map<string, string>()
  for (const listingId of uniqueIds) {
    const images = byListing.get(listingId)
    const raw =
      primaryListingImageUrl(images) ??
      images?.[0]?.thumbnail_url?.trim() ??
      images?.[0]?.url?.trim() ??
      null
    const absolute = klaviyoEmailListingPhotoUrl(raw)
    if (absolute.trim()) result.set(listingId, absolute)
  }

  return result
}
