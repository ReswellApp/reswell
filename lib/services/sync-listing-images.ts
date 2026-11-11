import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assignListingImageIdsFromExistingUrls,
  isListingImageUniqueViolation,
  listingImageUrlsEquivalent,
} from "@/lib/listing-image-identity"
import { persistableListingThumbnailUrl } from "@/lib/listing-media-proxy-url"
import {
  listingImageRowNeedsUpdate,
  listingImageRowsMatchPayload,
  listingImagesNeedingStorageVerify,
  type ListingImageSyncRow,
  type ListingImageUpdateOp,
} from "@/lib/services/listing-image-sync-diff"
import {
  orderListingImageWritesForPrimaryTrigger,
  type ListingImageWriteOrder,
} from "@/lib/services/listing-image-write-order"
import { deleteListingMediaRowsThenStorage } from "@/lib/services/listingStorageCleanup"
import { assertAllListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"

export type { ListingImageSyncRow, ListingImageUpdateOp } from "@/lib/services/listing-image-sync-diff"
export {
  listingImageRowsMatchPayload,
  listingImagesNeedingStorageVerify,
} from "@/lib/services/listing-image-sync-diff"

/** Row the reconcile persisted. Callers stamp `id` back onto the photo slot. */
export type SyncedListingImage = {
  id: string
  url: string
  thumbnailUrl: string | null
  isPrimary: boolean
  sortOrder: number
}

function normalizedThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  fullUrl?: string | null,
): string | null {
  return persistableListingThumbnailUrl(thumbnailUrl, fullUrl)
}

function syncedFromExistingRows(
  existingById: ReadonlyMap<string, ListingImageSyncRow>,
  images: ListingImageUpdateOp[],
): SyncedListingImage[] {
  return images.flatMap((img) => {
    if (!img.id) return []
    const existing = existingById.get(img.id)
    if (!existing) return []
    return [
      {
        id: existing.id,
        url: existing.url,
        thumbnailUrl: existing.thumbnail_url,
        isPrimary: existing.is_primary === true,
        sortOrder: existing.sort_order,
      },
    ]
  })
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

  if (error || !existingRows) return false
  return listingImageRowsMatchPayload(
    existingRows as ListingImageSyncRow[],
    images,
    removedImageIds,
  )
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
 * file. Unchanged existing photos skip storage HEAD checks. Writes run one
 * at a time, new primary last, so the cover trigger stamps photo 1. A unique
 * violation means a concurrent reconcile won the insert; this one adopts that
 * row instead of adding a second.
 */
export async function syncListingImages(
  supabase: SupabaseClient,
  listingId: string,
  removedImageIds: string[],
  images: ListingImageUpdateOp[],
): Promise<SyncedListingImage[]> {
  const { data: existingLoad, error: existingLoadError } = await supabase
    .from("listing_images")
    .select("id, sort_order, is_primary, url, thumbnail_url")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
  if (existingLoadError) throw new Error(existingLoadError.message)

  const existingRows = (existingLoad ?? []) as ListingImageSyncRow[]
  const reconciled = assignListingImageIdsFromExistingUrls(
    existingRows.map((row) => ({ id: row.id, url: row.url })),
    images,
  )
  const imagesToWrite = reconciled.images
  const existingById = new Map(existingRows.map((row) => [row.id, row]))
  const keptImageIds = new Set(imagesToWrite.flatMap((img) => (img.id ? [img.id] : [])))
  const idsToDelete = [
    ...removedImageIds.filter((id) => !keptImageIds.has(id)),
    ...reconciled.duplicateRowIds,
  ]

  if (
    idsToDelete.length === 0 &&
    listingImageRowsMatchPayload(existingRows, imagesToWrite, [])
  ) {
    return syncedFromExistingRows(existingById, imagesToWrite)
  }

  const imagesToVerify = listingImagesNeedingStorageVerify(existingById, imagesToWrite)
  await assertAllListingImageObjectsExist(
    imagesToVerify.map((img) => ({ url: img.url, thumbnailUrl: img.thumbnailUrl })),
  )

  await deleteListingMediaRowsThenStorage(
    supabase,
    "listing_images",
    listingId,
    idsToDelete,
    imagesToWrite.flatMap((img) => [img.url, img.thumbnailUrl]),
  )

  const inserts = imagesToWrite.filter((img) => !img.id && img.url.trim())
  if (idsToDelete.length > 0 && inserts.length > 0) {
    // Re-check inserts after deletes. A concurrent reconcile can remove storage
    // between the opening assert and these writes; never insert rows that 404
    // on the PDP.
    await assertAllListingImageObjectsExist(
      inserts.map((img) => ({ url: img.url, thumbnailUrl: img.thumbnailUrl })),
    )
  }

  const updates = imagesToWrite.filter((img): img is ListingImageUpdateOp & { id: string } =>
    Boolean(img.id),
  )

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
