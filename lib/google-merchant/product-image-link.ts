import { absoluteUrl } from "@/lib/site-metadata"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import {
  LISTING_MEDIA_PROXY_PATH_PREFIX,
  listingFullImageUrlFromRef,
  proxiedListingImageSrc,
  withListingMediaMerchantVariant,
} from "@/lib/listing-media-proxy-url"

/**
 * Extensions Google Merchant Center does not accept as image_link targets.
 * @see https://support.google.com/merchants/answer/12470659
 */
const GOOGLE_MERCHANT_UNSUPPORTED_IMAGE_EXT = /\.(heic|heif|avif)$/i

/** Best full-res storage URL for Merchant feeds — never a stored thumb when full exists. */
export function googleMerchantListingImageSourceUrl(
  img: ListingImageForCard,
): string | null {
  const full = listingFullImageUrlFromRef(img.url?.trim())
  if (full) return full
  return listingFullImageUrlFromRef(img.thumbnail_url?.trim())
}

/**
 * Absolute image_link for Google Merchant / Googlebot.
 *
 * Uses `/media/listings/...?variant=merchant` (≤1600px WebP, higher quality than PDP/tile)
 * sourced from the full-res object, not stored thumbs.
 */
export function googleMerchantListingImageUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null

  const trimmed = listingFullImageUrlFromRef(raw.trim()) ?? raw.trim()
  const proxied = proxiedListingImageSrc(trimmed)

  if (proxied.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) {
    return absoluteUrl(withListingMediaMerchantVariant(proxied))
  }

  const pathOnly = trimmed.split("?")[0] ?? trimmed
  if (GOOGLE_MERCHANT_UNSUPPORTED_IMAGE_EXT.test(pathOnly)) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return absoluteUrl(trimmed.startsWith("/") ? trimmed : `/${trimmed}`)
}
