import { revalidateTag, unstable_cache } from "next/cache"
import sharp from "sharp"
import {
  LISTING_CARD_MAX_LONG_EDGE,
  LISTING_FILM_MAX_LONG_EDGE,
  LISTING_THUMB_MAX_LONG_EDGE,
  LISTING_WEBP_QUALITY_CARD,
  LISTING_WEBP_QUALITY_FILM,
  LISTING_WEBP_QUALITY_THUMB,
} from "@/lib/listing-image-pipeline"
import {
  cachedPublicStorageObjectBody,
  getCachedPublicStorageObject,
  type PublicStorageBucket,
} from "@/lib/cache/public-storage-object"

export const LISTING_MEDIA_TILE_VARIANT = "tile" as const
export const LISTING_MEDIA_PDP_VARIANT = "pdp" as const
/** Browse cards. Stored at upload as `*-card2.*`; older objects are resized on demand. */
export const LISTING_MEDIA_CARD_VARIANT = "card" as const
/** Listing filmstrip. Stored at upload as `*-film2.*`; older objects are resized on demand. */
export const LISTING_MEDIA_FILM_VARIANT = "film" as const
/** Google Merchant / catalog crawlers — high-res WebP (≤1600px long edge). */
export const LISTING_MEDIA_MERCHANT_VARIANT = "merchant" as const

/**
 * Legacy `?variant=tile2` resize. Browse cards use the stored `*-card2.*`
 * derivative (960px) instead of this path.
 */
export const LISTING_TILE_MAX_LONG_EDGE = 1280
const LISTING_WEBP_QUALITY_TILE = 0.86

/** PDP hero renders ≤~512 CSS px wide — 1024px covers 2x retina without full-res payloads. */
export const LISTING_PDP_MAX_LONG_EDGE = 1024
const LISTING_WEBP_QUALITY_PDP = 0.78

/** Shopping ads — sharper than PDP; stays under upload full-res (2000px) cap. */
export const LISTING_MERCHANT_MAX_LONG_EDGE = 1600
const LISTING_WEBP_QUALITY_MERCHANT = 0.88

/** v1 was 640px @ 0.74 — bump the key so Data Cache does not keep serving those. */
const TILE_VARIANT_CACHE_TAG_PREFIX = "listing-tile-variant-v2" as const
/** v1 was 480px @ 0.80. v1 film was 200px @ 0.72. */
const CARD_VARIANT_CACHE_TAG_PREFIX = "listing-card-variant-v2" as const
const FILM_VARIANT_CACHE_TAG_PREFIX = "listing-film-variant-v2" as const

export type ListingMediaResizeVariant =
  | typeof LISTING_MEDIA_TILE_VARIANT
  | typeof LISTING_MEDIA_PDP_VARIANT
  | typeof LISTING_MEDIA_CARD_VARIANT
  | typeof LISTING_MEDIA_FILM_VARIANT
  | typeof LISTING_MEDIA_MERCHANT_VARIANT

const VARIANT_SPECS: Record<
  ListingMediaResizeVariant,
  { maxLongEdge: number; quality: number }
> = {
  [LISTING_MEDIA_TILE_VARIANT]: {
    maxLongEdge: LISTING_TILE_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_TILE,
  },
  [LISTING_MEDIA_PDP_VARIANT]: {
    maxLongEdge: LISTING_PDP_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_PDP,
  },
  [LISTING_MEDIA_MERCHANT_VARIANT]: {
    maxLongEdge: LISTING_MERCHANT_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_MERCHANT,
  },
  [LISTING_MEDIA_CARD_VARIANT]: {
    maxLongEdge: LISTING_CARD_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_CARD,
  },
  [LISTING_MEDIA_FILM_VARIANT]: {
    maxLongEdge: LISTING_FILM_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_FILM,
  },
}

export function listingMediaPathLooksLikeStoredThumb(objectPath: string): boolean {
  const file = objectPath.split("/").pop() ?? ""
  return file.includes("-thumb.")
}

export function listingMediaStoredDerivativeKind(objectPath: string): "card" | "film" | null {
  const file = objectPath.split("/").pop() ?? ""
  if (file.includes("-card2.") || file.includes("-card.")) return "card"
  if (file.includes("-film2.") || file.includes("-film.")) return "film"
  return null
}

/** Map a stored derivative path back to its `*-full.*` sibling. */
export function listingFullObjectPathFromDerivative(objectPath: string): string {
  return objectPath.replace(/-(?:card2|film2|card|film)\./, "-full.")
}

export async function resizeListingImageBufferToVariant(
  input: Buffer,
  variant: ListingMediaResizeVariant,
): Promise<Buffer> {
  const spec = VARIANT_SPECS[variant]
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(spec.maxLongEdge, spec.maxLongEdge, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: Math.round(spec.quality * 100), effort: 4 })
    .toBuffer()
}

export async function resizeListingImageBufferToTileVariant(input: Buffer): Promise<Buffer> {
  return resizeListingImageBufferToVariant(input, LISTING_MEDIA_TILE_VARIANT)
}

/** Persisted `*-thumb.webp` for compact rows (cart, checkout, nav) — not marketplace tiles. */
export async function resizeListingImageBufferToStoredThumb(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(LISTING_THUMB_MAX_LONG_EDGE, LISTING_THUMB_MAX_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: Math.round(LISTING_WEBP_QUALITY_THUMB * 100), effort: 4 })
    .toBuffer()
}

function variantCacheTag(
  bucket: PublicStorageBucket,
  objectPath: string,
  variant: ListingMediaResizeVariant,
): string {
  // Tile keeps its historical tag so existing cached entries stay valid.
  const prefix =
    variant === LISTING_MEDIA_TILE_VARIANT
      ? TILE_VARIANT_CACHE_TAG_PREFIX
      : variant === LISTING_MEDIA_CARD_VARIANT
        ? CARD_VARIANT_CACHE_TAG_PREFIX
        : variant === LISTING_MEDIA_FILM_VARIANT
          ? FILM_VARIANT_CACHE_TAG_PREFIX
          : `listing-${variant}-variant`
  return `${prefix}:${bucket}:${objectPath}`
}

async function loadListingVariantBody(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
  variant: ListingMediaResizeVariant,
): Promise<{ bodyBase64: string; contentType: string } | null> {
  const cached = await getCachedPublicStorageObject(bucket, objectPath, upstreamUrl)
  if (!cached) return null

  const resized = await resizeListingImageBufferToVariant(
    cachedPublicStorageObjectBody(cached),
    variant,
  )

  return {
    bodyBase64: resized.toString("base64"),
    contentType: "image/webp",
  }
}

/**
 * On-demand resized variant for listing objects.
 * `tile`: ≤1280px long edge WebP for marketplace cards (not the stored 640px thumb).
 * `pdp`: ≤1024px long edge WebP for the listing detail hero.
 * `merchant`: ≤1600px long edge WebP for Google Merchant / catalog feeds.
 */
export function getCachedListingVariantBody(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
  variant: ListingMediaResizeVariant,
): Promise<{ body: Buffer; contentType: string } | null> {
  const keyPrefix =
    variant === LISTING_MEDIA_TILE_VARIANT
      ? TILE_VARIANT_CACHE_TAG_PREFIX
      : variant === LISTING_MEDIA_CARD_VARIANT
        ? CARD_VARIANT_CACHE_TAG_PREFIX
        : variant === LISTING_MEDIA_FILM_VARIANT
          ? FILM_VARIANT_CACHE_TAG_PREFIX
          : `listing-${variant}-variant`
  const loader = unstable_cache(
    () => loadListingVariantBody(bucket, objectPath, upstreamUrl, variant),
    [keyPrefix, bucket, objectPath],
    {
      revalidate: 60 * 60 * 24 * 365,
      tags: [variantCacheTag(bucket, objectPath, variant)],
    },
  )

  return loader().then((cached) => {
    if (!cached) return null
    return {
      body: Buffer.from(cached.bodyBase64, "base64"),
      contentType: cached.contentType,
    }
  })
}

export function getCachedListingTileVariantBody(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  return getCachedListingVariantBody(bucket, objectPath, upstreamUrl, LISTING_MEDIA_TILE_VARIANT)
}

const LISTING_MEDIA_VARIANTS: ListingMediaResizeVariant[] = [
  LISTING_MEDIA_TILE_VARIANT,
  LISTING_MEDIA_PDP_VARIANT,
  LISTING_MEDIA_CARD_VARIANT,
  LISTING_MEDIA_FILM_VARIANT,
  LISTING_MEDIA_MERCHANT_VARIANT,
]

/** Drop proxied `/media/listings/*?variant=…` Data Cache entries after storage removal. */
export function revalidateListingMediaVariantCaches(
  bucket: PublicStorageBucket,
  objectPaths: Iterable<string>,
): void {
  for (const objectPath of objectPaths) {
    const trimmed = objectPath.trim()
    if (!trimmed) continue
    for (const variant of LISTING_MEDIA_VARIANTS) {
      revalidateTag(variantCacheTag(bucket, trimmed, variant), "max")
    }
  }
}
