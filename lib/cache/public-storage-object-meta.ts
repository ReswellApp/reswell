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
