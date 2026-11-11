import { listingImageUrlsEquivalent } from "@/lib/listing-image-identity"
import { persistableListingThumbnailUrl } from "@/lib/listing-thumb-url"

export type ListingImageUpdateOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  isPrimary: boolean
  sortOrder: number
}

export type ListingImageSyncRow = {
  id: string
  sort_order: number
  is_primary: boolean
  url: string
  thumbnail_url: string | null
}

function listingImageThumbnailsEquivalent(
  existing: ListingImageSyncRow,
  img: ListingImageUpdateOp,
): boolean {
  const existingThumb = typeof existing.thumbnail_url === "string" && existing.thumbnail_url.trim()
    ? existing.thumbnail_url.trim()
    : null
  const nextThumb = persistableListingThumbnailUrl(img.thumbnailUrl, img.url)
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

export function listingImageRowNeedsUpdate(
  existing: ListingImageSyncRow,
  img: ListingImageUpdateOp,
): boolean {
  if (existing.sort_order !== img.sortOrder) return true
  if (existing.is_primary !== img.isPrimary) return true

  const url = img.url.trim()
  if (url && !listingImageUrlsEquivalent(existing.url, url)) return true
  return !listingImageThumbnailsEquivalent(existing, img)
}

function listingImageUrlChanged(
  existing: ListingImageSyncRow,
  img: ListingImageUpdateOp,
): boolean {
  const url = img.url.trim()
  if (url && !listingImageUrlsEquivalent(existing.url, url)) return true
  return !listingImageThumbnailsEquivalent(existing, img)
}

/** True when removed ids are empty and every existing image row already matches the payload. */
export function listingImageRowsMatchPayload(
  existingRows: ListingImageSyncRow[],
  images: ListingImageUpdateOp[],
  removedImageIds: string[],
): boolean {
  if (removedImageIds.length > 0) return false
  if (images.some((img) => !img.id)) return false
  if (existingRows.length !== images.length) return false

  const existingById = new Map(existingRows.map((row) => [row.id, row]))
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
 * Photos that still need a storage HEAD. Existing rows whose files already
 * match the payload skip verification — they were confirmed on upload.
 */
export function listingImagesNeedingStorageVerify(
  existingById: ReadonlyMap<string, ListingImageSyncRow>,
  images: ListingImageUpdateOp[],
): ListingImageUpdateOp[] {
  return images.filter((img) => {
    const url = img.url.trim()
    if (!url) return false
    if (!img.id) return true
    const existing = existingById.get(img.id)
    if (!existing) return true
    return listingImageUrlChanged(existing, img)
  })
}
