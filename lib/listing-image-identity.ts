import {
  LISTING_MEDIA_PROXY_PATH_PREFIX,
  listingStorageObjectPathFromUrl,
} from "@/lib/listing-media-src"

/**
 * Stable identity for one uploaded listing photo.
 * Public storage URLs and `/media/listings/...` proxies for the same object match.
 */
export function listingImageUrlKey(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? ""
  if (!trimmed) return ""

  const storagePath = listingStorageObjectPathFromUrl(trimmed)
  if (storagePath) return storagePath

  if (trimmed.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) {
    const path = trimmed
      .slice(LISTING_MEDIA_PROXY_PATH_PREFIX.length)
      .split("?")[0]
      ?.split("#")[0]
    if (path && !path.includes("..")) return path
  }

  return trimmed
}

export function listingImageUrlsEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = listingImageUrlKey(a)
  const right = listingImageUrlKey(b)
  if (!left || !right) return left === right
  return left === right
}

export function isListingImageUniqueViolation(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false
  if (error.code === "23505") return true
  const message = error.message ?? ""
  return /duplicate key/i.test(message) && /listing_images/i.test(message)
}

export type ListingImageIdentityRow = {
  id: string
  url: string
}

export type ListingImageIdAssignment<T extends { id?: string; url: string }> = {
  images: T[]
  /** Extra rows that repeat a photo still in `images`. Delete the rows, keep the files. */
  duplicateRowIds: string[]
}

/**
 * A photo saved without an id is the same photo as an existing row with that
 * URL. Claim that row instead of inserting another copy. Rows that repeat a
 * claimed URL are duplicates.
 */
export function assignListingImageIdsFromExistingUrls<T extends { id?: string; url: string }>(
  existing: readonly ListingImageIdentityRow[],
  images: readonly T[],
): ListingImageIdAssignment<T> {
  const existingIds = new Set(existing.map((row) => row.id))
  const claimed = new Set<string>()
  for (const img of images) {
    if (img.id && existingIds.has(img.id)) claimed.add(img.id)
  }

  const assigned = images.map((img) => {
    if (img.id && existingIds.has(img.id)) return img
    const url = img.url.trim()
    if (!url) return img
    const match = existing.find(
      (row) => !claimed.has(row.id) && listingImageUrlsEquivalent(row.url, url),
    )
    if (!match) return img
    claimed.add(match.id)
    return { ...img, id: match.id }
  })

  const duplicateRowIds = existing
    .filter((row) => {
      if (claimed.has(row.id)) return false
      return assigned.some(
        (img) => img.url.trim() && listingImageUrlsEquivalent(row.url, img.url),
      )
    })
    .map((row) => row.id)

  return { images: assigned, duplicateRowIds }
}
