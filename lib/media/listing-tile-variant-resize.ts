import { unstable_cache } from "next/cache"
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

const TILE_VARIANT_CACHE_TAG_PREFIX = "listing-tile-variant" as const

export function listingMediaPathLooksLikeStoredThumb(objectPath: string): boolean {
  const file = objectPath.split("/").pop() ?? ""
  return file.includes("-thumb.")
}

export async function resizeListingImageBufferToTileVariant(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(LISTING_THUMB_MAX_LONG_EDGE, LISTING_THUMB_MAX_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: Math.round(LISTING_WEBP_QUALITY_THUMB * 100), effort: 4 })
    .toBuffer()
}

function tileVariantCacheTag(bucket: PublicStorageBucket, objectPath: string): string {
  return `${TILE_VARIANT_CACHE_TAG_PREFIX}:${bucket}:${objectPath}`
}

async function loadListingTileVariantBody(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<{ bodyBase64: string; contentType: string } | null> {
  const cached = await getCachedPublicStorageObject(bucket, objectPath, upstreamUrl)
  if (!cached) return null

  const resized = await resizeListingImageBufferToTileVariant(
    cachedPublicStorageObjectBody(cached),
  )

  return {
    bodyBase64: resized.toString("base64"),
    contentType: "image/webp",
  }
}

/**
 * On-demand browse-tile variant for legacy full-resolution listing objects (no stored thumb).
 * Output matches the client upload pipeline: ≤640px long edge WebP.
 */
export function getCachedListingTileVariantBody(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const loader = unstable_cache(
    () => loadListingTileVariantBody(bucket, objectPath, upstreamUrl),
    [TILE_VARIANT_CACHE_TAG_PREFIX, bucket, objectPath],
    {
      revalidate: 60 * 60 * 24 * 365,
      tags: [tileVariantCacheTag(bucket, objectPath)],
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
