import type { SupabaseClient } from "@supabase/supabase-js"
import { assertAllListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"

export type ListingImageInsertRow = {
  listing_id: string
  url: string
  thumbnail_url?: string | null
  is_primary: boolean
  sort_order: number
}

/**
 * Inserts gallery rows only when the referenced listings-bucket objects exist.
 * All server paths that create `listing_images` should use this helper.
 */
export async function insertListingImages(
  supabase: SupabaseClient,
  rows: ListingImageInsertRow[],
): Promise<void> {
  if (rows.length === 0) return

  await assertAllListingImageObjectsExist(
    rows.map((row) => ({ url: row.url, thumbnailUrl: row.thumbnail_url })),
  )

  const { error } = await supabase.from("listing_images").insert(rows)
  if (error) {
    throw new Error(error.message)
  }
}
