type ListingWithImages = {
  listing_images?: unknown
}

function listingHasPhoto(listing: ListingWithImages): boolean {
  const images = Array.isArray(listing.listing_images) ? listing.listing_images : []
  return images.some((image) => {
    if (!image || typeof image !== "object") return false
    const url = "url" in image && typeof image.url === "string" ? image.url.trim() : ""
    return url.length > 0
  })
}

/** Prefer the top pick when it has a photo, otherwise the first listing that does. */
export function pickModelPageListingWithImage<T extends ListingWithImages>(
  listings: readonly T[],
  topPick: T | null = null,
): T | null {
  if (topPick && listingHasPhoto(topPick)) return topPick
  return listings.find(listingHasPhoto) ?? null
}
