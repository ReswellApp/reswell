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

export type ModelPageHeroImageSource = "live" | "sold" | "none"

/**
 * Hero photo is a marketplace listing. A live listing wins. A past sale is
 * the placeholder when nothing is listed. Catalog model images are not used.
 */
export function modelPageHeroImage(input: {
  livePhotoUrl: string | null | undefined
  soldPhotoUrl: string | null | undefined
  fallbackSoldUrl: string | null | undefined
}): { url: string | null; source: ModelPageHeroImageSource } {
  const live = input.livePhotoUrl?.trim() || null
  if (live) return { url: live, source: "live" }
  const sold = input.soldPhotoUrl?.trim() || input.fallbackSoldUrl?.trim() || null
  if (sold) return { url: sold, source: "sold" }
  return { url: null, source: "none" }
}
