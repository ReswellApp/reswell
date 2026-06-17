import { absoluteUrl } from "@/lib/site-metadata"
import {
  LISTING_MEDIA_PROXY_PATH_PREFIX,
  proxiedListingImageSrc,
  withListingMediaPdpVariant,
} from "@/lib/listing-media-proxy-url"

/**
 * Extensions Google Merchant Center does not accept as image_link targets.
 * @see https://support.google.com/merchants/answer/12470659
 */
const GOOGLE_MERCHANT_UNSUPPORTED_IMAGE_EXT = /\.(heic|heif|avif)$/i

/**
 * Absolute image_link for Google Merchant / Googlebot.
 *
 * Listing storage URLs are proxied through `/media/listings/...?variant=pdp`, which
 * transcodes any source (including HEIC) to WebP with `Content-Type: image/webp`.
 * Raw HEIC/HEIF/AVIF URLs that cannot be proxied are omitted.
 */
export function googleMerchantListingImageUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null

  const trimmed = raw.trim()
  const proxied = proxiedListingImageSrc(trimmed)

  if (proxied.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) {
    return absoluteUrl(withListingMediaPdpVariant(proxied))
  }

  const pathOnly = trimmed.split("?")[0] ?? trimmed
  if (GOOGLE_MERCHANT_UNSUPPORTED_IMAGE_EXT.test(pathOnly)) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return absoluteUrl(trimmed.startsWith("/") ? trimmed : `/${trimmed}`)
}
