export type ListingImageWriteOrder = {
  isPrimary: boolean
  sortOrder: number
}

/**
 * `listing_images` row trigger rewrites `primary_image_url` and
 * `tile_gallery_images` after every insert or update. Parallel writes race:
 * a slower update that clears the old primary can commit a snapshot taken
 * before the new primary landed, so the tile stays on photo 2.
 *
 * Run writes one at a time and put the new primary last. The last trigger
 * then sees every earlier commit and stamps the cover to photo 1.
 */
export function orderListingImageWritesForPrimaryTrigger<T extends ListingImageWriteOrder>(
  writes: readonly T[],
): T[] {
  return [...writes].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? 1 : -1
    return a.sortOrder - b.sortOrder
  })
}
