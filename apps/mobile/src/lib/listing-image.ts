/** How far from the current gallery page a photo must be before it mounts. */
export const LISTING_GALLERY_LOAD_RADIUS = 1

export const LISTING_IMAGE_CACHE_POLICY = "memory-disk" as const

export function listingGalleryPhotoIsNear(frame: number, current: number): boolean {
  return Math.abs(frame - current) <= LISTING_GALLERY_LOAD_RADIUS
}

export function listingImageRecyclingKey(uri: string, listingId?: string): string {
  return listingId ? `${listingId}:${uri}` : uri
}
