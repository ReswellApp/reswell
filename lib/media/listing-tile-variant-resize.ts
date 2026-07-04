import { revalidateTag, unstable_cache } from "next/cache"
import sharp from "sharp"
import {
  LISTING_THUMB_MAX_LONG_EDGE,
  LISTING_WEBP_QUALITY_THUMB,
} from "@/lib/listing-image-pipeline"
import {
  cachedPublicStorageObjectBody,
  getCachedPublicStorageObject,
  type PublicStorageBucket,
} from "@/lib/cache/public-storage-object"

export const LISTING_MEDIA_TILE_VARIANT = "tile" as const
export const LISTING_MEDIA_PDP_VARIANT = "pdp" as const
/** Google Merchant / catalog crawlers — high-res WebP (≤1600px long edge). */
export const LISTING_MEDIA_MERCHANT_VARIANT = "merchant" as const

/** PDP hero renders ≤~512 CSS px wide — 1024px covers 2x retina without full-res payloads. */
export const LISTING_PDP_MAX_LONG_EDGE = 1024
const LISTING_WEBP_QUALITY_PDP = 0.78

/** Shopping ads — sharper than PDP; stays under upload full-res (2000px) cap. */
export const LISTING_MERCHANT_MAX_LONG_EDGE = 1600
const LISTING_WEBP_QUALITY_MERCHANT = 0.88

const TILE_VARIANT_CACHE_TAG_PREFIX = "listing-tile-variant" as const

export type ListingMediaResizeVariant =
  | typeof LISTING_MEDIA_TILE_VARIANT
  | typeof LISTING_MEDIA_PDP_VARIANT
  | typeof LISTING_MEDIA_MERCHANT_VARIANT

const VARIANT_SPECS: Record<
  ListingMediaResizeVariant,
  { maxLongEdge: number; quality: number }
> = {
  [LISTING_MEDIA_TILE_VARIANT]: {
    maxLongEdge: LISTING_THUMB_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_THUMB,
  },
  [LISTING_MEDIA_PDP_VARIANT]: {
    maxLongEdge: LISTING_PDP_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_PDP,
  },
  [LISTING_MEDIA_MERCHANT_VARIANT]: {
    maxLongEdge: LISTING_MERCHANT_MAX_LONG_EDGE,
    quality: LISTING_WEBP_QUALITY_MERCHANT,
  },
}

export function listingMediaPathLooksLikeStoredThumb(objectPath: string): boolean {
  const file = objectPath.split("/").pop() ?? ""
  return file.includes("-thumb.")
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

function variantCacheTag(
  bucket: PublicStorageBucket,
  objectPath: string,
  variant: ListingMediaResizeVariant,
): string {
  // Tile keeps its historical tag so existing cached entries stay valid.
  const prefix =
    variant === LISTING_MEDIA_TILE_VARIANT
      ? TILE_VARIANT_CACHE_TAG_PREFIX
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
 * `tile`: ≤640px long edge WebP (matches the client upload thumb pipeline).
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
