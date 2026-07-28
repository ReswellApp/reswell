import { revalidateTag } from "next/cache"
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
