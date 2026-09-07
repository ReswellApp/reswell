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
  | "brand-request-logos"
  | "seo-assets"

/**
 * Brand logos stay cached until an admin replaces them (`revalidateBrandLogoMedia`).
 * Other buckets keep a long TTL because filenames are content-addressed.
 */
function publicStorageObjectRevalidate(bucket: PublicStorageBucket): number | false {
  if (bucket === "brand-assets" || bucket === "brand-request-logos") return false
  return PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS
}

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

function publicStorageFetchNext(bucket: PublicStorageBucket, objectPath: string) {
  return {
    revalidate: publicStorageObjectRevalidate(bucket),
    tags: [publicStorageObjectCacheTag(bucket, objectPath)],
  }
}

function upstreamObjectExceedsDataCacheLimit(contentLengthHeader: string | null): boolean {
  if (!contentLengthHeader) return true
  const bytes = Number.parseInt(contentLengthHeader, 10)
  if (!Number.isFinite(bytes) || bytes < 0) return true
  return bytes > PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES
}

async function shouldBypassPublicStorageDataCache(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<boolean> {
  try {
    const res = await fetch(upstreamUrl, {
      method: "HEAD",
      headers: { Accept: "image/*" },
      cache: "force-cache",
      next: publicStorageFetchNext(bucket, objectPath),
    })
    if (!res.ok) return true
    return upstreamObjectExceedsDataCacheLimit(res.headers.get("content-length"))
  } catch {
    return true
  }
}

async function fetchPublicStorageObjectUpstream(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
  options?: { bypassDataCache?: boolean },
): Promise<CachedPublicStorageObject | null> {
  let res: Response
  try {
    // Objects over the Data Cache limit must use `no-store`: a `force-cache` fetch
    // would attempt (and fail) to write the >2MB body into the fetch data cache,
    // logging "Failed to set Next.js data cache" on every origin miss.
    res = await fetch(
      upstreamUrl,
      options?.bypassDataCache
        ? { headers: { Accept: "image/*" }, cache: "no-store" }
        : {
            headers: { Accept: "image/*" },
            cache: "force-cache",
            next: publicStorageFetchNext(bucket, objectPath),
          },
    )
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
  const revalidate = publicStorageObjectRevalidate(bucket)
  return unstable_cache(
    () => fetchPublicStorageObjectUpstream(bucket, objectPath, upstreamUrl),
    revalidate === false
      ? [PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX, bucket, objectPath, "until-revalidate"]
      : [PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX, bucket, objectPath],
    {
      revalidate,
      tags: [publicStorageObjectCacheTag(bucket, objectPath)],
    },
  )
}

/**
 * Next.js Data Cache for objects under ~1.5MB raw; larger files fetch upstream each origin
 * miss (Vercel CDN still caches the `/media/*` response via `PUBLIC_MEDIA_CACHE_CONTROL`).
 * Brand logos use tag-only cache (`revalidate: false`) until `revalidateBrandLogoMedia`.
 */
export async function getCachedPublicStorageObject(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<CachedPublicStorageObject | null> {
  if (await shouldBypassPublicStorageDataCache(bucket, objectPath, upstreamUrl)) {
    return fetchPublicStorageObjectUpstream(bucket, objectPath, upstreamUrl, {
      bypassDataCache: true,
    })
  }
  return getCachedPublicStorageObjectLoader(bucket, objectPath, upstreamUrl)()
}

export function cachedPublicStorageObjectBody(cached: CachedPublicStorageObject): Buffer {
  return Buffer.from(cached.bodyBase64, "base64")
}
