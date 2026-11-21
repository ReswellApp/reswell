import { unstable_cache } from "next/cache"
import {
  PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES,
  PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX,
  publicStorageObjectCacheTag,
  type CachedPublicStorageObject,
  type PublicStorageBucket,
} from "@/lib/cache/public-storage-object-meta"

export {
  PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES,
  PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX,
  PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS,
  publicStorageObjectCacheTag,
  type CachedPublicStorageObject,
  type PublicStorageBucket,
} from "@/lib/cache/public-storage-object-meta"

/**
 * Listing/blog/avatar bytes are cached on the Vercel CDN (`PUBLIC_MEDIA_CACHE_CONTROL`).
 * Putting those bodies in the Next.js Data Cache bills ISR write units (8 KB) per
 * unique object and was the bulk of ISR spend. Brand logos stay in Data Cache so
 * an admin replace (`revalidateBrandLogoMedia`) drops them immediately.
 */
function usesPublicStorageDataCache(bucket: PublicStorageBucket): boolean {
  return bucket === "brand-assets" || bucket === "brand-request-logos"
}

async function fetchPublicStorageObjectUpstream(
  upstreamUrl: string,
): Promise<CachedPublicStorageObject | null> {
  let res: Response
  try {
    res = await fetch(upstreamUrl, {
      headers: { Accept: "image/*" },
      cache: "no-store",
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream"
  const buf = await res.arrayBuffer()
  return {
    bodyBase64: Buffer.from(buf).toString("base64"),
    contentType,
  }
}

function getCachedBrandAssetLoader(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): () => Promise<CachedPublicStorageObject | null> {
  return unstable_cache(
    () => fetchPublicStorageObjectUpstream(upstreamUrl),
    [PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX, bucket, objectPath, "until-revalidate"],
    {
      revalidate: false,
      tags: [publicStorageObjectCacheTag(bucket, objectPath)],
    },
  )
}

/**
 * Brand logos: Data Cache until `revalidateBrandLogoMedia`.
 * Everything else: origin fetch on CDN miss only.
 */
export async function getCachedPublicStorageObject(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<CachedPublicStorageObject | null> {
  if (!usesPublicStorageDataCache(bucket)) {
    return fetchPublicStorageObjectUpstream(upstreamUrl)
  }
  return getCachedBrandAssetLoader(bucket, objectPath, upstreamUrl)()
}

export function cachedPublicStorageObjectBody(cached: CachedPublicStorageObject): Buffer {
  return Buffer.from(cached.bodyBase64, "base64")
}
