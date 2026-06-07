import { revalidateTag } from "next/cache"
import {
  type PublicStorageBucket,
  publicStorageObjectCacheTag,
} from "@/lib/cache/public-storage-object"

/** Drop proxied `/media/*` Data Cache entries after objects are removed from Storage. */
export function revalidatePublicStorageObjects(
  bucket: PublicStorageBucket,
  objectPaths: Iterable<string>,
): void {
  for (const objectPath of objectPaths) {
    const trimmed = objectPath.trim()
    if (!trimmed) continue
    revalidateTag(publicStorageObjectCacheTag(bucket, trimmed), 'max')
  }
}
