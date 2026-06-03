import { unstable_cache } from "next/cache"

/** Immutable public storage objects (listing/blog filenames are content-addressed by upload time). */
export const PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS = 60 * 60 * 24 * 365

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

/** Next.js Data Cache: one Supabase origin fetch per object per deploy region until revalidated. */
export async function getCachedPublicStorageObject(
  bucket: PublicStorageBucket,
  objectPath: string,
  upstreamUrl: string,
): Promise<CachedPublicStorageObject | null> {
  return getCachedPublicStorageObjectLoader(bucket, objectPath, upstreamUrl)()
}

export function cachedPublicStorageObjectBody(cached: CachedPublicStorageObject): Buffer {
  return Buffer.from(cached.bodyBase64, "base64")
}
