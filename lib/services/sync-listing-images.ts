import type { SupabaseClient } from "@supabase/supabase-js"
import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-proxy-url"
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

function listingImageUrlsEquivalent(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return left === right
  if (left === right) return true

  const leftPath = listingStorageObjectPathFromUrl(left)
  const rightPath = listingStorageObjectPathFromUrl(right)
  if (leftPath && rightPath) return leftPath === rightPath

  return false
}

function listingImageThumbnailsEquivalent(
  existing: ExistingListingImageRow,
  img: ListingImageUpdateOp,
): boolean {
  const existingThumb = normalizedThumbnailUrl(existing.thumbnail_url)
  const nextThumb = normalizedThumbnailUrl(img.thumbnailUrl)
  if (existingThumb === nextThumb) return true
  if (existingThumb == null && nextThumb && listingImageUrlsEquivalent(existing.url, nextThumb)) {
    return true
  }
  if (nextThumb == null && existingThumb && listingImageUrlsEquivalent(existing.url, existingThumb)) {
    return true
  }
  if (existingThumb && nextThumb) {
    return listingImageUrlsEquivalent(existingThumb, nextThumb)
  }
  return false
}

function listingImageRowNeedsUpdate(
  existing: ExistingListingImageRow,
  img: ListingImageUpdateOp,
): boolean {
  if (existing.sort_order !== img.sortOrder) return true
  if (existing.is_primary !== img.isPrimary) return true

  const url = img.url.trim()
  if (url && !listingImageUrlsEquivalent(existing.url, url)) return true
  return !listingImageThumbnailsEquivalent(existing, img)
}

/** True when removed ids are empty and every existing image row already matches the payload. */
export async function listingImagesAlreadySynced(
  supabase: SupabaseClient,
  listingId: string,
  removedImageIds: string[],
  images: ListingImageUpdateOp[],
): Promise<boolean> {
  if (removedImageIds.length > 0) return false
  if (images.some((img) => !img.id)) return false

  const { data: existingRows, error } = await supabase
    .from("listing_images")
    .select("id, sort_order, is_primary, url, thumbnail_url")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })

  if (error || !existingRows || existingRows.length !== images.length) {
    return false
  }

  const existingById = new Map(
    existingRows.map((row) => [row.id as string, row as ExistingListingImageRow]),
  )

  for (const img of images) {
    if (!img.id) return false
    const existing = existingById.get(img.id)
    if (!existing || listingImageRowNeedsUpdate(existing, img)) {
      return false
    }
  }

  return true
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

  if (await listingImagesAlreadySynced(supabase, listingId, [], images)) {
    return
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
