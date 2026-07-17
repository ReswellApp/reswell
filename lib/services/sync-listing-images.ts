import type { SupabaseClient } from "@supabase/supabase-js"
import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"

export type ListingImageUpdateOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  isPrimary: boolean
  sortOrder: number
}

type ExistingListingImageRow = {
  id: string
  sort_order: number
  is_primary: boolean
  url: string
  thumbnail_url: string | null
}

function normalizedThumbnailUrl(thumbnailUrl: string | null | undefined): string | null {
  return typeof thumbnailUrl === "string" && thumbnailUrl.trim() ? thumbnailUrl.trim() : null
}

function listingImageRowNeedsUpdate(
  existing: ExistingListingImageRow,
  img: ListingImageUpdateOp,
): boolean {
  if (existing.sort_order !== img.sortOrder) return true
  if (existing.is_primary !== img.isPrimary) return true

  const url = img.url.trim()
  if (!url) return false
  if (existing.url !== url) return true

  const thumb = normalizedThumbnailUrl(img.thumbnailUrl)
  const existingThumb = normalizedThumbnailUrl(existing.thumbnail_url)
  return existingThumb !== thumb
}

/**
 * Syncs `listing_images` for a listing update. Removes deleted rows, inserts new
 * photos, and updates order/metadata. Runs inserts/updates in parallel and skips
 * unchanged existing rows so text-only edits do not trigger N sequential DB calls.
 */
export async function syncListingImages(
  supabase: SupabaseClient,
  listingId: string,
  removedImageIds: string[],
  images: ListingImageUpdateOp[],
): Promise<void> {
  if (removedImageIds.length > 0) {
    const { data: removedRows } = await supabase
      .from("listing_images")
      .select("url, thumbnail_url")
      .eq("listing_id", listingId)
      .in("id", removedImageIds)
    const removedUrls: string[] = []
    for (const r of removedRows ?? []) {
      if (r.url?.trim()) removedUrls.push(r.url)
      if (r.thumbnail_url?.trim()) removedUrls.push(r.thumbnail_url)
    }
    if (removedUrls.length > 0) {
      await removeListingImageFilesFromStorage(supabase, removedUrls)
    }
    await supabase.from("listing_images").delete().in("id", removedImageIds).eq("listing_id", listingId)
  }

  const inserts = images.filter((img) => !img.id && img.url.trim())
  const updates = images.filter((img): img is ListingImageUpdateOp & { id: string } => Boolean(img.id))

  let existingById = new Map<string, ExistingListingImageRow>()
  if (updates.length > 0) {
    const { data: existingRows, error: existingErr } = await supabase
      .from("listing_images")
      .select("id, sort_order, is_primary, url, thumbnail_url")
      .eq("listing_id", listingId)
      .in(
        "id",
        updates.map((img) => img.id),
      )

    if (existingErr) {
      throw new Error(existingErr.message)
    }

    existingById = new Map(
      (existingRows ?? []).map((row) => [row.id as string, row as ExistingListingImageRow]),
    )
  }

  await Promise.all([
    ...inserts.map(async (img) => {
      const { error } = await supabase.from("listing_images").insert({
        listing_id: listingId,
        url: img.url.trim(),
        thumbnail_url: normalizedThumbnailUrl(img.thumbnailUrl),
        is_primary: img.isPrimary,
        sort_order: img.sortOrder,
      })
      if (error) throw new Error(error.message)
    }),
    ...updates.map(async (img) => {
      const existing = existingById.get(img.id)
      if (existing && !listingImageRowNeedsUpdate(existing, img)) {
        return
      }

      const rowUpdate: {
        sort_order: number
        is_primary: boolean
        url?: string
        thumbnail_url?: string | null
      } = { sort_order: img.sortOrder, is_primary: img.isPrimary }

      const url = img.url.trim()
      if (url) {
        rowUpdate.url = url
        rowUpdate.thumbnail_url = normalizedThumbnailUrl(img.thumbnailUrl)
      }

      const { error } = await supabase
        .from("listing_images")
        .update(rowUpdate)
        .eq("id", img.id)
        .eq("listing_id", listingId)
      if (error) throw new Error(error.message)
    }),
  ])
}
