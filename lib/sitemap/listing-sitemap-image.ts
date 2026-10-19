import { googleMerchantListingImageSourceUrl, googleMerchantListingImageUrl } from "@/lib/google-merchant/product-image-link"
import { orderedListingGalleryImages } from "@/lib/listing-image-display"

const SITEMAP_IMAGE_CAP = 1
const SCHEMA_IMAGE_CAP = 8

function absoluteGalleryUrls(images: unknown, cap: number): string[] {
  const ordered = orderedListingGalleryImages(images)
  const urls: string[] = []
  for (const image of ordered) {
    const source = googleMerchantListingImageSourceUrl(image)
    const absolute = source ? googleMerchantListingImageUrl(source) : null
    if (!absolute || urls.includes(absolute)) continue
    urls.push(absolute)
    if (urls.length >= cap) break
  }
  return urls
}

/** One crawlable image URL for a listing sitemap row. */
export function primarySitemapImageUrl(images: unknown): string | null {
  return absoluteGalleryUrls(images, SITEMAP_IMAGE_CAP)[0] ?? null
}

/** Product JSON-LD gallery. Primary photo first, capped to match the public API. */
export function listingSchemaImageUrls(images: unknown): string[] {
  return absoluteGalleryUrls(images, SCHEMA_IMAGE_CAP)
}
