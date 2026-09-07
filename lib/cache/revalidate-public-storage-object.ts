import { revalidateTag } from "next/cache"
import { brandLogoStorageRef } from "@/lib/brand-media-proxy-url"
import {
  type PublicStorageBucket,
  publicStorageObjectCacheTag,
} from "@/lib/cache/public-storage-object"

type RevalidatePublicStorageObjectsOptions = {
  /**
   * When true, expire tagged Data Cache entries immediately (needed for mutable
   * avatar/banner replacements served through `/media/*`). Default is SWR `'max'`.
   */
  expireImmediately?: boolean
}

/** Drop proxied `/media/*` Data Cache entries after objects are removed from Storage. */
export function revalidatePublicStorageObjects(
  bucket: PublicStorageBucket,
  objectPaths: Iterable<string>,
  options?: RevalidatePublicStorageObjectsOptions,
): void {
  const profile = options?.expireImmediately ? ({ expire: 0 } as const) : ("max" as const)
  for (const objectPath of objectPaths) {
    const trimmed = objectPath.trim()
    if (!trimmed) continue
    revalidateTag(publicStorageObjectCacheTag(bucket, trimmed), profile)
  }
}

/** Drop cached `/media/brands` (and request-logo) bytes after a brand logo URL changes. */
export function revalidateBrandLogoMedia(
  ...logoUrls: Array<string | null | undefined>
): void {
  const brandAssets: string[] = []
  const requestLogos: string[] = []
  for (const url of logoUrls) {
    const ref = brandLogoStorageRef(url)
    if (!ref) continue
    if (ref.bucket === "brand-assets") brandAssets.push(ref.objectPath)
    else requestLogos.push(ref.objectPath)
  }
  if (brandAssets.length > 0) {
    revalidatePublicStorageObjects("brand-assets", brandAssets, { expireImmediately: true })
  }
  if (requestLogos.length > 0) {
    revalidatePublicStorageObjects("brand-request-logos", requestLogos, {
      expireImmediately: true,
    })
  }
}
