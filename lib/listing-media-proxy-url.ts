import { isConfiguredNextImageSrc } from "@/lib/brands/logo-mark"
import { absoluteUrl } from "@/lib/site-metadata"
import {
  LISTING_MEDIA_CARD_VARIANT_PARAM,
  LISTING_MEDIA_FILM_VARIANT_PARAM,
  LISTING_MEDIA_PROXY_PATH_PREFIX,
  LISTING_MEDIA_TILE_VARIANT_PARAM,
  LISTING_MEDIA_TILE_VARIANT_PARAM_LEGACY,
  listingFullImageUrlFromRef,
  listingStorageObjectPathFromUrl,
  proxiedListingImageSrc,
  withListingMediaTileVariant,
  withListingMediaVariant,
} from "@/lib/listing-media-src"

export {
  LISTING_MEDIA_CARD_VARIANT_PARAM,
  LISTING_MEDIA_FILM_VARIANT_PARAM,
  LISTING_MEDIA_PROXY_PATH_PREFIX,
  LISTING_MEDIA_TILE_VARIANT_PARAM,
  LISTING_MEDIA_TILE_VARIANT_PARAM_LEGACY,
  listingFullImageUrlFromRef,
  listingStorageObjectPathFromUrl,
  proxiedListingImageSrc,
  withListingMediaTileVariant,
}

/** Same-origin listing video stream — see `app/media/listing-videos/[...path]/route.ts`. */
export const LISTING_VIDEO_PROXY_PATH_PREFIX = "/media/listing-videos/" as const

/** Resize hint for the listing detail hero (≤1024px long edge WebP). */
export const LISTING_MEDIA_PDP_VARIANT_PARAM = "pdp" as const

/** High-quality WebP for Google Merchant image_link (≤1600px long edge). */
export const LISTING_MEDIA_MERCHANT_VARIANT_PARAM = "merchant" as const

export function isProxiedListingMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)
}

/**
 * Skip Vercel Image Optimization when:
 * - the file is already served pre-sized via `/media/*` (avoid transform + cache-write charges)
 * - the src is a blob/data URL
 * - the remote host is not in `images.remotePatterns` — next/image's default loader
 *   throws `unconfigured-host` at render and takes down the page (brand logos often
 *   point at manufacturer WordPress/Shopify hosts that are not allowlisted)
 */
export function listingImageShouldBypassOptimization(src: string | null | undefined): boolean {
  if (typeof src !== "string" || !src) return false
  if (
    src.startsWith("/media/") ||
    src.startsWith("blob:") ||
    src.startsWith("data:")
  ) {
    return true
  }
  return !isConfiguredNextImageSrc(src)
}

/** Appends `?variant=pdp` so `/media/listings` serves a cached ≤1024px WebP for the PDP hero. */
export function withListingMediaPdpVariant(src: string): string {
  return withListingMediaVariant(src, LISTING_MEDIA_PDP_VARIANT_PARAM)
}

/** Appends `?variant=merchant` for catalog feeds (≤1600px long edge WebP). */
export function withListingMediaMerchantVariant(src: string): string {
  return withListingMediaVariant(src, LISTING_MEDIA_MERCHANT_VARIANT_PARAM)
}

export function listingStorageObjectPathFromProxiedSrc(
  src: string | null | undefined,
): string | null {
  const t = src?.trim()
  if (!t || !t.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) return null
  const path = t.slice(LISTING_MEDIA_PROXY_PATH_PREFIX.length).split("?")[0]?.split("#")[0]
  if (!path || path.includes("..")) return null
  return path
}

/** Direct Supabase public URL for a listings-bucket object (bypasses the /media proxy). */
export function listingPublicStorageObjectUrl(objectPath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "")
  const path = objectPath.trim()
  if (!base || !path || path.includes("..")) return null
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${base}/storage/v1/object/public/listings/${encoded}`
}

function listingBucketObjectPathFromRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return (
    listingStorageObjectPathFromUrl(trimmed) ??
    listingStorageObjectPathFromProxiedSrc(proxiedListingImageSrc(trimmed))
  )
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Direct public storage URL when `raw` resolves to a listings-bucket object.
 * Used by catalog feeds when a static file exists (no on-demand ?variant= resize).
 */
export function listingDirectPublicImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const objectPath = listingBucketObjectPathFromRaw(raw)
  if (!objectPath) return null
  return listingPublicStorageObjectUrl(objectPath)
}

/**
 * Same-origin PDP video URL. Streams via `/media/listing-videos` so Chrome gets a
 * playable Content-Type (QuickTime objects are advertised as `video/mp4`) and Range
 * requests are not buffered through the image cache.
 */
export function listingPdpVideoPlaybackSrc(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) return ""
  const objectPath = listingBucketObjectPathFromRaw(trimmed)
  if (!objectPath) return trimmed
  const encoded = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/")
  return `${LISTING_VIDEO_PROXY_PATH_PREFIX}${encoded}`
}

export {
  listingDerivedThumbUrlFromFullUrl,
  persistableListingThumbnailUrl,
} from "@/lib/listing-thumb-url"

/** Absolute `https://reswell.app/media/listings/...` for OG tags, catalog feeds, and crawlers. */
export function absoluteProxiedListingMediaUrl(url: string | null | undefined): string | undefined {
  const proxied = proxiedListingImageSrc(url)
  if (!proxied.trim()) return undefined
  if (/^https?:\/\//i.test(proxied)) return proxied
  return absoluteUrl(proxied)
}
