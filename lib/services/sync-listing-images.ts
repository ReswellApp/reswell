import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assignListingImageIdsFromExistingUrls,
  isListingImageUniqueViolation,
  listingImageUrlsEquivalent,
} from "@/lib/listing-image-identity"
import { persistableListingThumbnailUrl } from "@/lib/listing-media-proxy-url"
import {
  orderListingImageWritesForPrimaryTrigger,
  type ListingImageWriteOrder,
} from "@/lib/services/listing-image-write-order"
import { deleteListingMediaRowsThenStorage } from "@/lib/services/listingStorageCleanup"
import { assertAllListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"

export type ListingImageUpdateOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  isPrimary: boolean
  sortOrder: number
}

/** Row the reconcile persisted. Callers stamp `id` back onto the photo slot. */
export type SyncedListingImage = {
  id: string
  url: string
  thumbnailUrl: string | null
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

function normalizedThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  fullUrl?: string | null,
): string | null {
  return persistableListingThumbnailUrl(thumbnailUrl, fullUrl)
}

function listingImageThumbnailsEquivalent(
  existing: ExistingListingImageRow,
  img: ListingImageUpdateOp,
): boolean {
  const existingThumb = typeof existing.thumbnail_url === "string" && existing.thumbnail_url.trim()
    ? existing.thumbnail_url.trim()
    : null
  const nextThumb = normalizedThumbnailUrl(img.thumbnailUrl, img.url)
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

async function adoptExistingListingImage(
  supabase: SupabaseClient,
  listingId: string,
  img: ListingImageUpdateOp,
): Promise<boolean> {
  const url = img.url.trim()
  if (!url) return false

  const { data, error } = await supabase
    .from("listing_images")
    .select("id, url")
    .eq("listing_id", listingId)
  if (error || !data) return false

  const match = data.find((row) =>
    listingImageUrlsEquivalent(typeof row.url === "string" ? row.url : "", url),
  )
  if (!match?.id) return false

  const { error: updateError } = await supabase
    .from("listing_images")
    .update({
      sort_order: img.sortOrder,
      is_primary: img.isPrimary,
      url,
      thumbnail_url: normalizedThumbnailUrl(img.thumbnailUrl, img.url),
    })
    .eq("id", match.id)
    .eq("listing_id", listingId)
  if (updateError) throw new Error(updateError.message)
  return true
}

async function readSyncedListingImages(
  supabase: SupabaseClient,
  listingId: string,
): Promise<SyncedListingImage[]> {
  const { data, error } = await supabase
    .from("listing_images")
    .select("id, url, thumbnail_url, is_primary, sort_order")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    url: typeof row.url === "string" ? row.url : "",
    thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    isPrimary: row.is_primary === true,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
  }))
}

/**
 * One reconcile for a listing gallery. Draft save and publish both call this.
 *
 * The file is uploaded before a row exists, so the storage object is the
 * identity. A photo with no id claims the row that already points at that
 * file. Writes run one at a time, new primary last, so the cover trigger
 * stamps photo 1. A unique violation means a concurrent reconcile won the
 * insert; this one adopts that row instead of adding a second.
 */
export async function syncListingImages(
  supabase: SupabaseClient,
  listingId: string,
  removedImageIds: string[],
  images: ListingImageUpdateOp[],
): Promise<SyncedListingImage[]> {
  await assertAllListingImageObjectsExist(
    images.map((img) => ({ url: img.url, thumbnailUrl: img.thumbnailUrl })),
  )

  const keptImageIds = new Set(images.flatMap((img) => (img.id ? [img.id] : [])))
  await deleteListingMediaRowsThenStorage(
    supabase,
    "listing_images",
    listingId,
    removedImageIds.filter((id) => !keptImageIds.has(id)),
    images.flatMap((img) => [img.url, img.thumbnailUrl]),
  )

  const { data: existingRows, error: existingLoadError } = await supabase
    .from("listing_images")
    .select("id, url")
    .eq("listing_id", listingId)
  if (existingLoadError) throw new Error(existingLoadError.message)

  const reconciled = assignListingImageIdsFromExistingUrls(
    (existingRows ?? []).map((row) => ({
      id: String(row.id),
      url: typeof row.url === "string" ? row.url : "",
    })),
    images,
  )
  const imagesToWrite = reconciled.images

  if (reconciled.duplicateRowIds.length > 0) {
    await deleteListingMediaRowsThenStorage(
      supabase,
      "listing_images",
      listingId,
      reconciled.duplicateRowIds,
      imagesToWrite.flatMap((img) => [img.url, img.thumbnailUrl]),
    )
  }

  if (await listingImagesAlreadySynced(supabase, listingId, [], imagesToWrite)) {
    return readSyncedListingImages(supabase, listingId)
  }

  const inserts = imagesToWrite.filter((img) => !img.id && img.url.trim())
  const updates = imagesToWrite.filter((img): img is ListingImageUpdateOp & { id: string } =>
    Boolean(img.id),
  )

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

  type PendingImageWrite = ListingImageWriteOrder &
    (
      | { kind: "insert"; img: ListingImageUpdateOp }
      | { kind: "update"; img: ListingImageUpdateOp & { id: string } }
    )

  const pendingWrites: PendingImageWrite[] = [
    ...inserts.map((img) => ({
      kind: "insert" as const,
      img,
      isPrimary: img.isPrimary,
      sortOrder: img.sortOrder,
    })),
    ...updates
      .filter((img) => {
        const existing = existingById.get(img.id)
        return !existing || listingImageRowNeedsUpdate(existing, img)
      })
      .map((img) => ({
        kind: "update" as const,
        img,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder,
      })),
  ]

  for (const write of orderListingImageWritesForPrimaryTrigger(pendingWrites)) {
    if (write.kind === "insert") {
      const img = write.img
      const { error } = await supabase.from("listing_images").insert({
        listing_id: listingId,
        url: img.url.trim(),
        thumbnail_url: normalizedThumbnailUrl(img.thumbnailUrl, img.url),
        is_primary: img.isPrimary,
        sort_order: img.sortOrder,
      })
      if (error) {
        if (
          isListingImageUniqueViolation(error) &&
          (await adoptExistingListingImage(supabase, listingId, img))
        ) {
          continue
        }
        throw new Error(error.message)
      }
      continue
    }

    const img = write.img
    const rowUpdate: {
      sort_order: number
      is_primary: boolean
      url?: string
      thumbnail_url?: string | null
    } = { sort_order: img.sortOrder, is_primary: img.isPrimary }

    const url = img.url.trim()
    if (url) {
      rowUpdate.url = url
      rowUpdate.thumbnail_url = normalizedThumbnailUrl(img.thumbnailUrl, img.url)
    }

    const { error } = await supabase
      .from("listing_images")
      .update(rowUpdate)
      .eq("id", img.id)
      .eq("listing_id", listingId)
    if (error) throw new Error(error.message)
  }

  return readSyncedListingImages(supabase, listingId)
}
