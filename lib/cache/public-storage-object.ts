import { unstable_cache } from "next/cache"
import {
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
 * Listing, blog, and avatar bytes are cached on the Vercel CDN
 * (`publicMediaCacheHeaders`). Writing those bodies into the Next.js Data Cache
 * bills an ISR write for every 8 KB and was the bulk of ISR spend. Brand logos
 * stay tag-cached so `revalidateBrandLogoMedia` drops them on replace.
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
 * Everything else: fetch on a CDN miss only.
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
