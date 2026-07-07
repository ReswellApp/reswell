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

/**
 * Accepted static image_link formats — must link directly to the file, not a resize script.
 * @see https://support.google.com/merchants/answer/12157889
 */
const GOOGLE_MERCHANT_ACCEPTED_IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i

function googleMerchantImagePathOnly(raw: string): string {
  const withoutQuery = raw.split("?")[0] ?? raw
  try {
    if (/^https?:\/\//i.test(withoutQuery)) {
      return new URL(withoutQuery).pathname
    }
  } catch {
    // fall through with path-only string
  }
  return withoutQuery
}

function googleMerchantImageNeedsTranscode(pathOnly: string): boolean {
  if (GOOGLE_MERCHANT_UNSUPPORTED_IMAGE_EXT.test(pathOnly)) return true
  return !GOOGLE_MERCHANT_ACCEPTED_IMAGE_EXT.test(pathOnly)
}

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
 * Uses same-origin `/media/listings/...-full.webp` static paths. In production, Next.js
 * rewrites those URLs to Supabase public objects at the edge so Google fetches a direct image
 * file instead of a serverless handler (avoids image_link_internal_error / _fallback).
 *
 * Falls back to on-demand `?variant=merchant` only when the stored object needs transcoding
 * (HEIC/HEIF/AVIF or unknown extension).
 *
 * @see https://support.google.com/merchants/answer/12157889
 */
export function googleMerchantListingImageUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null

  const trimmed = listingFullImageUrlFromRef(raw.trim()) ?? raw.trim()
  const pathOnly = googleMerchantImagePathOnly(trimmed)
  const proxied = proxiedListingImageSrc(trimmed)

  if (proxied.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) {
    if (googleMerchantImageNeedsTranscode(pathOnly)) {
      return absoluteUrl(withListingMediaMerchantVariant(proxied))
    }
    return absoluteUrl(proxied)
  }

  if (GOOGLE_MERCHANT_UNSUPPORTED_IMAGE_EXT.test(pathOnly)) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return absoluteUrl(trimmed.startsWith("/") ? trimmed : `/${trimmed}`)
}
