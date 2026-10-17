export type ListingImageWriteOrder = {
  isPrimary: boolean
  sortOrder: number
}

/**
 * Cover columns are recomputed once per image statement, from the gallery
 * already committed. Separate requests still race: a slower update that
 * clears the old primary can commit a snapshot taken before the new primary
 * landed, so the tile stays on photo 2.
 *
 * Run writes one at a time and put the new primary last. The last statement
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
