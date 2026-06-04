import { unstable_cache } from "next/cache"

/** Immutable public storage objects (listing/blog filenames are content-addressed by upload time). */
export const PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS = 60 * 60 * 24 * 365

/**
 * Next.js Data Cache rejects entries over 2MB; cached values are base64 (~4/3 size).
 * Larger objects skip `unstable_cache` and rely on route `Cache-Control` + the edge CDN.
 */
export const PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES = Math.floor((2 * 1024 * 1024 * 3) / 4) - 8192

export const PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX = "public-storage-object" as const

export type PublicStorageBucket =
  | "listings"
  | "blog-images"
  | "avatars"
  | "brand-assets"
  | "surfer-assets"
  | "brand-request-logos"
  | "seo-assets"

export type CachedPublicStorageObject = {
  bodyBase64: string
  contentType: string
}

export function publicStorageObjectCacheTag(
  bucket: PublicStorageBucket,
  objectPath: string,
): string {
  return `${PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX}:${bucket}:${objectPath}`
}

function upstreamObjectExceedsDataCacheLimit(contentLengthHeader: string | null): boolean {
  if (!contentLengthHeader) return true
  const bytes = Number.parseInt(contentLengthHeader, 10)
  if (!Number.isFinite(bytes) || bytes < 0) return true
  return bytes > PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES
}

async function shouldBypassPublicStorageDataCache(upstreamUrl: string): Promise<boolean> {
  try {
    const res = await fetch(upstreamUrl, {
      method: "HEAD",
      headers: { Accept: "image/*" },
      cache: "force-cache",
      next: { revalidate: PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS },
    })
    if (!res.ok) return true
    return upstreamObjectExceedsDataCacheLimit(res.headers.get("content-length"))
  } catch {
    return true
  }
}

async function fetchPublicStorageObjectUpstream(
  upstreamUrl: string,
): Promise<CachedPublicStorageObject | null> {
  let res: Response
  try {
    res = await fetch(upstreamUrl, {
      headers: { Accept: "image/*" },
      cache: "force-cache",
      next: { revalidate: PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS },
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

function getCachedPublicStorageObjectLoader(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): () => Promise<CachedPublicStorageObject | null> {
  return unstable_cache(
    () => fetchPublicStorageObjectUpstream(upstreamUrl),
    [PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX, bucket, objectPath],
    {
      revalidate: PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS,
      tags: [publicStorageObjectCacheTag(bucket, objectPath)],
    },
  )
}

/**
 * Next.js Data Cache for objects under ~1.5MB raw; larger files fetch upstream each origin
 * miss (Vercel CDN still caches the `/media/*` response via `PUBLIC_MEDIA_CACHE_CONTROL`).
 */
export async function getCachedPublicStorageObject(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<CachedPublicStorageObject | null> {
  if (await shouldBypassPublicStorageDataCache(upstreamUrl)) {
    return fetchPublicStorageObjectUpstream(upstreamUrl)
  }
  return getCachedPublicStorageObjectLoader(bucket, objectPath, upstreamUrl)()
}

export function cachedPublicStorageObjectBody(cached: CachedPublicStorageObject): Buffer {
  return Buffer.from(cached.bodyBase64, "base64")
}
